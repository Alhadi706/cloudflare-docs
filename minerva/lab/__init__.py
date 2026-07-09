"""
MINERVA Lab — Phase 13
======================
Scientific Validation & Benchmark Laboratory.

ISOLATION GUARANTEE:
  This package must NEVER write to production tables.
  All lab experiments use the 'minerva_lab' schema in PostgreSQL,
  or a separate SQLite file during testing.

  Production data MAY be READ (in read-only mode) for replaying history,
  but results and benchmarks are stored separately.

  Simulated alerts (alert_sim.py) are ALWAYS tagged:
    {"is_test_data": True, "lab_experiment_id": ...}
  and stored only in minerva_lab.simulated_alerts.

USAGE:
  from minerva.lab import LabSession
  session = LabSession.create("my-experiment-v1")
  results = session.run_scenario("WATER_LEAK_001")
"""

__version__ = "13.0.0"
LAB_SCHEMA = "minerva_lab"           # isolated PostgreSQL schema
TEST_DATA_MARKER = "LAB_TEST_DATA"   # never remove this tag from test data
