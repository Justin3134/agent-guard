from neo4j import GraphDatabase
import os
import logging
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("prism.neo4j")


class PrismGraph:
    def __init__(self):
        uri = os.getenv("NEO4J_URI")
        user = os.getenv("NEO4J_USERNAME", "neo4j")
        password = os.getenv("NEO4J_PASSWORD")
        self.session_id = None
        self.driver = None

        if uri and password:
            try:
                self.driver = GraphDatabase.driver(uri, auth=(user, password))
                self.driver.verify_connectivity()
                logger.info(f"✅ Neo4j connected: {uri}")
            except Exception as e:
                logger.warning(f"⚠️ Neo4j connection failed: {e}. Graph features disabled.")
                self.driver = None
        else:
            logger.warning("⚠️ NEO4J_URI / NEO4J_PASSWORD not set. Graph features disabled.")

    def set_session(self, session_id: str):
        self.session_id = session_id

    def clear_session(self):
        if not self.driver or not self.session_id:
            return
        try:
            with self.driver.session() as session:
                session.run(
                    "MATCH (n {session_id: $sid}) DETACH DELETE n",
                    sid=self.session_id,
                )
        except Exception as e:
            logger.warning(f"clear_session failed: {e}")

    def add_finding(self, agent_name: str, topic: str, finding: str, category: str, confidence: float = 0.8):
        if not self.driver or not self.session_id:
            return
        try:
            with self.driver.session() as session:
                session.run(
                    """
                    MERGE (t:Topic {name: $topic, session_id: $sid})
                    CREATE (f:Finding {
                        text: $finding,
                        agent: $agent,
                        category: $category,
                        confidence: $confidence,
                        session_id: $sid,
                        created_at: datetime()
                    })
                    CREATE (f)-[:ABOUT]->(t)
                    """,
                    topic=topic,
                    finding=finding,
                    agent=agent_name,
                    category=category,
                    confidence=confidence,
                    sid=self.session_id,
                )
        except Exception as e:
            logger.warning(f"add_finding failed: {e}")

    def add_relationship(self, topic_a: str, relationship: str, topic_b: str):
        if not self.driver or not self.session_id:
            return
        try:
            with self.driver.session() as session:
                session.run(
                    """
                    MERGE (a:Topic {name: $a, session_id: $sid})
                    MERGE (b:Topic {name: $b, session_id: $sid})
                    MERGE (a)-[:RELATES_TO {type: $rel, session_id: $sid}]->(b)
                    """,
                    a=topic_a,
                    b=topic_b,
                    rel=relationship,
                    sid=self.session_id,
                )
        except Exception as e:
            logger.warning(f"add_relationship failed: {e}")

    def get_all_findings(self) -> list:
        if not self.driver or not self.session_id:
            return []
        try:
            with self.driver.session() as session:
                result = session.run(
                    """
                    MATCH (f:Finding {session_id: $sid})-[:ABOUT]->(t:Topic)
                    RETURN f.text as finding, f.agent as agent,
                           f.category as category, f.confidence as confidence,
                           t.name as topic
                    ORDER BY t.name, f.agent
                    """,
                    sid=self.session_id,
                )
                return [dict(r) for r in result]
        except Exception as e:
            logger.warning(f"get_all_findings failed: {e}")
            return []

    def get_graph_data(self) -> dict:
        if not self.driver or not self.session_id:
            return {"nodes": [], "edges": []}
        try:
            with self.driver.session() as session:
                nodes_result = session.run(
                    """
                    MATCH (n {session_id: $sid})
                    RETURN elementId(n) as id, labels(n)[0] as type,
                           coalesce(n.name, left(n.text, 50)) as label,
                           coalesce(n.agent, '') as agent
                    """,
                    sid=self.session_id,
                )

                edges_result = session.run(
                    """
                    MATCH (a {session_id: $sid})-[r]->(b {session_id: $sid})
                    RETURN elementId(a) as source, elementId(b) as target, type(r) as type
                    """,
                    sid=self.session_id,
                )

                return {
                    "nodes": [dict(n) for n in nodes_result],
                    "edges": [dict(e) for e in edges_result],
                }
        except Exception as e:
            logger.warning(f"get_graph_data failed: {e}")
            return {"nodes": [], "edges": []}

    def get_synthesis_context(self) -> str:
        findings = self.get_all_findings()
        if not findings:
            return "No findings available yet."

        by_topic: dict[str, list] = {}
        for f in findings:
            topic = f["topic"]
            if topic not in by_topic:
                by_topic[topic] = []
            by_topic[topic].append(f)

        output = "KNOWLEDGE GRAPH CONTENTS:\n\n"
        for topic, topic_findings in by_topic.items():
            output += f"TOPIC: {topic}\n"
            for f in topic_findings:
                output += f"  [{f['agent'].upper()}] {f['finding']}\n"
            output += "\n"

        return output

    def close(self):
        if self.driver:
            self.driver.close()


prism_graph = PrismGraph()
