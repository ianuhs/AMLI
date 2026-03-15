import logging
import pandas as pd
import igraph as ig

logger = logging.getLogger(__name__)


def compute_graph_features(dfs: dict, features_df: pd.DataFrame) -> pd.DataFrame:
    """
    Build a directed transaction graph with igraph and compute graph-based
    features per account: PageRank, degree centrality, betweenness, and
    Louvain community membership.
    """
    tx = dfs["transactions"]

    logger.info("Building transaction graph with igraph...")

    # Build edge list (aggregate by sender-receiver pair)
    edges_agg = (
        tx.groupby(["orig_acct", "bene_acct"])
        .agg(weight=("amount", "sum"), count=("amount", "count"))
        .reset_index()
    )

    # Build vertex index with vectorized operations
    vertices = list(set(edges_agg["orig_acct"].tolist() + edges_agg["bene_acct"].tolist()))
    vertex_map = {v: i for i, v in enumerate(vertices)}

    g = ig.Graph(directed=True)
    g.add_vertices(len(vertices))
    g.vs["name"] = vertices

    src_indices = edges_agg["orig_acct"].map(vertex_map).tolist()
    tgt_indices = edges_agg["bene_acct"].map(vertex_map).tolist()
    edge_list = list(zip(src_indices, tgt_indices))
    weights = edges_agg["weight"].tolist()

    g.add_edges(edge_list)
    g.es["weight"] = weights

    logger.info("Graph: %d vertices, %d edges", g.vcount(), g.ecount())

    # --- Compute metrics ---
    logger.info("Computing PageRank...")
    pagerank = g.pagerank(weights="weight", directed=True)

    logger.info("Computing betweenness centrality...")
    betweenness = g.betweenness(directed=True)
    max_b = max(betweenness) if max(betweenness) > 0 else 1
    betweenness_norm = [b / max_b for b in betweenness]

    logger.info("Computing degree centrality...")
    in_degree = g.indegree()
    out_degree = g.outdegree()
    n = g.vcount()
    in_degree_centrality = [d / (n - 1) if n > 1 else 0 for d in in_degree]
    out_degree_centrality = [d / (n - 1) if n > 1 else 0 for d in out_degree]

    logger.info("Computing Louvain communities...")
    # Convert to undirected for community detection
    g_undirected = g.as_undirected(combine_edges="sum")
    communities = g_undirected.community_multilevel(weights="weight")
    membership = communities.membership
    community_sizes = {}
    for m in membership:
        community_sizes[m] = community_sizes.get(m, 0) + 1

    # --- Build graph features DataFrame ---
    graph_data = []
    for i, v_name in enumerate(vertices):
        graph_data.append({
            "acct_id": v_name,
            "pagerank": pagerank[i],
            "betweenness": betweenness_norm[i],
            "in_degree": in_degree[i],
            "out_degree": out_degree[i],
            "in_degree_centrality": in_degree_centrality[i],
            "out_degree_centrality": out_degree_centrality[i],
            "community_id": membership[i],
            "community_size": community_sizes.get(membership[i], 0),
        })

    graph_df = pd.DataFrame(graph_data)

    # Merge with existing features
    merged = features_df.merge(graph_df, on="acct_id", how="left")

    # Fill missing graph features (accounts with no transactions)
    graph_cols = [
        "pagerank", "betweenness", "in_degree", "out_degree",
        "in_degree_centrality", "out_degree_centrality",
        "community_id", "community_size",
    ]
    for col in graph_cols:
        if col in merged.columns:
            merged[col] = merged[col].fillna(0)

    logger.info("Graph features computed for %d accounts", len(merged))
    return merged
