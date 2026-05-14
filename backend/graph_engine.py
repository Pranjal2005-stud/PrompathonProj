"""
graph_engine.py
---------------

Vendor relationship graph engine for procurement fraud detection.

Features:
- vendor_degree
- cluster_size
- pagerank
- shared_bank_flag
- shared_gst_flag
- shared_address_flag
- shell_vendor_flag
- co_occurrence_score

Optimized for:
- stable graph behavior
- realistic fraud clustering
- low false-positive shell vendors
- fast inference
"""

import hashlib
import logging

import networkx as nx
import numpy as np
import pandas as pd

print("GRAPH ENGINE LOADED SUCCESSFULLY")

from config import (
    GRAPH_WEIGHT_BANK,
    GRAPH_WEIGHT_GST,
    GRAPH_WEIGHT_ADDRESS,
)

log = logging.getLogger(__name__)

# =============================================================================
# CACHE
# =============================================================================

_GRAPH_CACHE = {}

# =============================================================================
# INVALID VALUES
# =============================================================================

INVALID_VALUES = {
    "unknown",
    "nan",
    "",
    "none",
    "null",
    "n/a",
    "na",
    "0",
    "-",
}

# =============================================================================
# HELPERS
# =============================================================================

def _is_invalid(val) -> bool:

    val = str(val).strip().lower()

    return (
        val in INVALID_VALUES
        or len(val) <= 1
    )


# =============================================================================
# CLEANING
# =============================================================================

def _clean(series: pd.Series) -> pd.Series:

    return (
        series
        .fillna("unknown")
        .astype(str)
        .str.strip()
        .str.lower()
    )


# =============================================================================
# CACHE KEY
# =============================================================================

def _cache_key(df: pd.DataFrame) -> str:

    cols = [

        c for c in [

            "vendor_id",
            "bank_account",
            "gst_number",
            "vendor_address"

        ]

        if c in df.columns
    ]

    raw = (
        df[cols]
        .fillna("")
        .astype(str)
        .values
        .tobytes()
    )

    return hashlib.md5(raw).hexdigest()


# =============================================================================
# BUILD GRAPH
# =============================================================================

def _build_graph(df: pd.DataFrame) -> nx.Graph:

    G = nx.Graph()

    # -------------------------------------------------------------------------
    # ADD ALL VENDORS
    # -------------------------------------------------------------------------

    for vendor in df["vendor_id"].unique():

        G.add_node(vendor)

    # -------------------------------------------------------------------------
    # EDGE CREATION
    # -------------------------------------------------------------------------

    def _add_edges(column: str, weight: float):

        if column not in df.columns:
            return

        grouped = (

            df[
                ~df[column].apply(_is_invalid)
            ]

            .groupby(column)["vendor_id"]

            .unique()
        )

        for _, vendors in grouped.items():

            vendors = list(set(vendors))

            # -------------------------------------------------------------
            # MINIMUM SHARING
            # -------------------------------------------------------------

            if len(vendors) < 2:
                continue

            # -------------------------------------------------------------
            # PREVENT GRAPH EXPLOSION
            # Ignore overly common metadata
            # -------------------------------------------------------------

            if len(vendors) > 12:
                continue

            # -------------------------------------------------------------
            # CREATE EDGES
            # -------------------------------------------------------------

            for i in range(len(vendors)):

                for j in range(i + 1, len(vendors)):

                    v1 = vendors[i]
                    v2 = vendors[j]

                    if v1 == v2:
                        continue

                    if G.has_edge(v1, v2):

                        G[v1][v2]["weight"] += weight

                    else:

                        G.add_edge(
                            v1,
                            v2,
                            weight=weight
                        )

    # -------------------------------------------------------------------------
    # BUILD RELATIONSHIPS
    # -------------------------------------------------------------------------

    _add_edges(
        "bank_account",
        GRAPH_WEIGHT_BANK
    )

    _add_edges(
        "gst_number",
        GRAPH_WEIGHT_GST
    )

    _add_edges(
        "vendor_address",
        GRAPH_WEIGHT_ADDRESS
    )

    return G


# =============================================================================
# COMPUTE METRICS
# =============================================================================

def _compute_metrics(G: nx.Graph) -> dict:

    degree_dict = dict(G.degree())

    # -------------------------------------------------------------------------
    # CLUSTERS
    # -------------------------------------------------------------------------

    cluster_map = {}

    for component in nx.connected_components(G):

        size = len(component)

        for node in component:

            cluster_map[node] = size

    # -------------------------------------------------------------------------
    # PAGERANK
    # -------------------------------------------------------------------------

    if G.number_of_edges() > 0:

        try:

            pagerank = nx.pagerank(
                G,
                weight="weight",
                alpha=0.85,
                max_iter=100
            )

        except nx.PowerIterationFailedConvergence:

            pagerank = {

                node: 1.0 / max(
                    G.number_of_nodes(),
                    1
                )

                for node in G.nodes()
            }

    else:

        pagerank = {

            node: 0.0
            for node in G.nodes()
        }

    # -------------------------------------------------------------------------
    # NORMALIZATION CONSTANTS
    # -------------------------------------------------------------------------

    max_degree = max(
        max(degree_dict.values(), default=0),
        1
    )

    max_cluster = max(
        max(cluster_map.values(), default=1),
        1
    )

    max_pr = max(
        max(pagerank.values(), default=1e-9),
        1e-9
    )

    # -------------------------------------------------------------------------
    # METRICS
    # -------------------------------------------------------------------------

    metrics = {}

    for node in G.nodes():

        degree = float(
            degree_dict.get(node, 0)
        )

        cluster_size = float(
            cluster_map.get(node, 1)
        )

        pr = float(
            pagerank.get(node, 0.0)
        )

        # -----------------------------------------------------------------
        # CO-OCCURRENCE SCORE
        # -----------------------------------------------------------------

        degree_score = (
            (degree / max_degree) * 40.0
        )

        cluster_score = (np.log1p(cluster_size) / np.log1p(max_cluster)) * 30.0

        pagerank_score = np.log1p(pr * 1000) * 5.0

        co_occurrence_score = (

            degree_score
            +
            cluster_score
            +
            pagerank_score

        )

        co_occurrence_score = float(

            np.clip(
                co_occurrence_score,
                0,
                100
            )
        )

        # -----------------------------------------------------------------
        # STRICT SHELL VENDOR DETECTION
        # -----------------------------------------------------------------

        shell_vendor_flag = int(

            (
                degree >= 6
            )

            and

            (
                cluster_size >= 5
            )

            and

            (
                pr >= np.percentile(list(pagerank.values()), 85)
            )

            and

            (
                co_occurrence_score >= 75
            )

        )

        # -----------------------------------------------------------------
        # STORE
        # -----------------------------------------------------------------

        metrics[node] = {

            "vendor_degree":
                round(degree, 2),

            "cluster_size":
                round(cluster_size, 2),

            "community_size":
                round(cluster_size, 2),

            "pagerank":
                round(pr, 6),

            "shell_vendor_flag":
                shell_vendor_flag,

            "co_occurrence_score":
                round(co_occurrence_score, 2),
        }

    return metrics


# =============================================================================
# PUBLIC API
# =============================================================================

def enrich_with_graph_features(
    df: pd.DataFrame
) -> pd.DataFrame:

    df = df.copy()

    # -------------------------------------------------------------------------
    # CLEAR CACHE TEMPORARILY
    # -------------------------------------------------------------------------

    _GRAPH_CACHE.clear()

    # -------------------------------------------------------------------------
    # REQUIRED COLUMNS
    # -------------------------------------------------------------------------

    required_columns = [

        "vendor_id",
        "bank_account",
        "gst_number",
        "vendor_address",
    ]

    for col in required_columns:

        if col not in df.columns:

            df[col] = "unknown"

        df[col] = _clean(df[col])

    # -------------------------------------------------------------------------
    # CACHE KEY
    # -------------------------------------------------------------------------

    key = _cache_key(df)

    # -------------------------------------------------------------------------
    # BUILD GRAPH
    # -------------------------------------------------------------------------

    if key not in _GRAPH_CACHE:

        log.info(
            "[graph_engine] Building graph..."
        )

        G = _build_graph(df)

        _GRAPH_CACHE[key] = (
            _compute_metrics(G)
        )

    metrics = _GRAPH_CACHE[key]

    # -------------------------------------------------------------------------
    # MAP METRICS
    # -------------------------------------------------------------------------

    metric_columns = [

        "vendor_degree",
        "cluster_size",
        "community_size",
        "pagerank",
        "shell_vendor_flag",
        "co_occurrence_score",
    ]

    for feature in metric_columns:

        df[feature] = df["vendor_id"].map(

            lambda v, f=feature:

                metrics.get(v, {}).get(f, 0)

        ).fillna(0)

    # -------------------------------------------------------------------------
    # SHARED FLAGS
    # -------------------------------------------------------------------------

    def _shared_flag(column: str):

        if column not in df.columns:

            return pd.Series(
                0,
                index=df.index
            )

        valid = (
            ~df[column].apply(_is_invalid)
        )

        counts = (

            df.groupby(column)["vendor_id"]

            .transform("nunique")
        )

        return (

            (counts > 1)

            &

            (counts <= 4)

            &

            valid

        ).astype(int)

    df["shared_bank_flag"] = _shared_flag(
        "bank_account"
    )

    df["shared_gst_flag"] = _shared_flag(
        "gst_number"
    )

    df["shared_address_flag"] = _shared_flag(
        "vendor_address"
    )

    # -------------------------------------------------------------------------
    # FINAL CLEANING
    # -------------------------------------------------------------------------

    graph_columns = [

        "vendor_degree",
        "cluster_size",
        "community_size",
        "pagerank",

        "shell_vendor_flag",
        "co_occurrence_score",

        "shared_bank_flag",
        "shared_gst_flag",
        "shared_address_flag",
    ]

    for col in graph_columns:

        df[col] = (

            pd.to_numeric(
                df[col],
                errors="coerce"
            )

            .fillna(0)
        )

    return df