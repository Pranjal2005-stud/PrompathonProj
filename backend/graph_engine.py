"""
graph_engine.py
---------------
Builds a real inter-vendor relationship graph from shared metadata
(bank accounts, GST numbers, addresses) and computes meaningful
network features on a consistent 0-100 scale.

All output columns are on 0-100 scale EXCEPT pagerank/betweenness
which are raw centrality values (0-1) used only internally.
"""

import networkx as nx
import pandas as pd
import numpy as np


def enrich_with_graph_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    # Ensure required columns exist
    for col in ["vendor_id", "bank_account", "gst_number", "vendor_address"]:
        if col not in df.columns:
            df[col] = "unknown"
        df[col] = df[col].fillna("unknown").astype(str).str.strip()

    # ── Build inter-vendor graph ───────────────────────────────────────────────
    # Edges connect DIFFERENT vendors that share an identifier.
    # Edge weight accumulates per shared attribute.
    G = nx.Graph()

    def _add_edges(group_col: str, weight: float):
        groups = df.groupby(group_col)["vendor_id"].unique()
        for identifier, vendors in groups.items():
            # Skip "unknown" identifiers — they would falsely connect everyone
            if str(identifier).lower() in ("unknown", "nan", "", "none"):
                continue
            vendors = [v for v in set(vendors)]
            if len(vendors) < 2:
                continue
            for i in range(len(vendors)):
                for j in range(i + 1, len(vendors)):
                    v1, v2 = vendors[i], vendors[j]
                    if v1 == v2:          # no self-loops
                        continue
                    if G.has_edge(v1, v2):
                        G[v1][v2]["weight"] += weight
                    else:
                        G.add_edge(v1, v2, weight=weight)

    _add_edges("bank_account",   weight=3.0)   # strongest signal
    _add_edges("gst_number",     weight=2.5)   # strong signal
    _add_edges("vendor_address", weight=1.5)   # moderate signal

    # ── Per-vendor shared-identifier flags ────────────────────────────────────
    def _shared_flag(group_col: str) -> pd.Series:
        counts = df.groupby(group_col)["vendor_id"].transform("nunique")
        # Only flag when the identifier is not "unknown"
        valid  = ~df[group_col].str.lower().isin(["unknown", "nan", "", "none"])
        return ((counts > 1) & valid).astype(int)

    df["shared_bank_flag"]    = _shared_flag("bank_account")
    df["shared_gst_flag"]     = _shared_flag("gst_number")
    df["shared_address_flag"] = _shared_flag("vendor_address")

    # ── Graph metrics ─────────────────────────────────────────────────────────
    all_vendors = df["vendor_id"].unique().tolist()

    # Add isolated nodes so every vendor gets a metric
    for v in all_vendors:
        if v not in G:
            G.add_node(v)

    degree_dict = dict(G.degree())

    # Cluster membership
    cluster_map: dict = {}
    for component in nx.connected_components(G):
        size = len(component)
        for vendor in component:
            cluster_map[vendor] = size

    # Centrality — only meaningful when graph has edges
    if G.number_of_edges() > 0:
        pagerank_dict     = nx.pagerank(G, weight="weight", alpha=0.85)
        betweenness_dict  = nx.betweenness_centrality(G, normalized=True)
    else:
        pagerank_dict    = {v: 1.0 / max(len(all_vendors), 1) for v in all_vendors}
        betweenness_dict = {v: 0.0 for v in all_vendors}

    # Map back to DataFrame rows
    df["vendor_degree"]          = df["vendor_id"].map(degree_dict).fillna(0).astype(float)
    df["cluster_size"]           = df["vendor_id"].map(cluster_map).fillna(1).astype(float)
    df["pagerank"]               = df["vendor_id"].map(pagerank_dict).fillna(0.0).astype(float)
    df["betweenness_centrality"] = df["vendor_id"].map(betweenness_dict).fillna(0.0).astype(float)

    # ── Shell vendor flag ─────────────────────────────────────────────────────
    # Requires at least 2 of the 3 shared-identifier signals AND graph degree >= 1
    df["shell_vendor_flag"] = (
        (df["shared_bank_flag"] + df["shared_gst_flag"] + df["shared_address_flag"] >= 2) |
        ((df["shared_bank_flag"] == 1) & (df["vendor_degree"] >= 2))
    ).astype(int)

    # ── co_occurrence_score on 0-100 scale ────────────────────────────────────
    # Combines degree, cluster size, and centrality into a single 0-100 signal.
    # Each component is normalized before combining so no single metric dominates.
    max_degree  = float(df["vendor_degree"].max())  if df["vendor_degree"].max()  > 0 else 1.0
    max_cluster = float(df["cluster_size"].max())   if df["cluster_size"].max()   > 0 else 1.0
    max_pr      = float(df["pagerank"].max())        if df["pagerank"].max()        > 0 else 1.0
    max_bw      = float(df["betweenness_centrality"].max()) if df["betweenness_centrality"].max() > 0 else 1.0

    degree_norm  = (df["vendor_degree"]          / max_degree)  * 40.0
    cluster_norm = (df["cluster_size"]           / max_cluster) * 20.0
    pr_norm      = (df["pagerank"]               / max_pr)      * 25.0
    bw_norm      = (df["betweenness_centrality"] / max_bw)      * 15.0

    df["co_occurrence_score"] = (
        degree_norm + cluster_norm + pr_norm + bw_norm
    ).clip(0, 100).fillna(0.0)

    return df
