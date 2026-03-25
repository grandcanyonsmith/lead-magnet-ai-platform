import os
import sys


sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.dependency_resolver import DependencyResolver


def test_build_dependency_graph_treats_empty_depends_on_as_explicit():
    steps = [
        {"step_name": "First", "step_order": 0, "depends_on": []},
        {"step_name": "Second", "step_order": 1, "depends_on": []},
    ]

    dependency_graph = DependencyResolver.build_dependency_graph(steps)

    assert dependency_graph == {
        0: [],
        1: [],
    }
