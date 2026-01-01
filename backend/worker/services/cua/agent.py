import logging
from typing import Dict, Any, Optional
from services.cua.components.state import AgentState
from services.cua.components.planner import ActionPlanner
from services.cua.components.executor import ToolExecutor
from services.openai_client import OpenAIClient

logger = logging.getLogger(__name__)

class CUAgent:
    """
    Computer Use Agent (CUA) Orchestrator.
    Co-ordinates State, Planner, and Executor to achieve a goal.
    """
    
    def __init__(self, openai_client: OpenAIClient, browser_service: Any):
        self.planner = ActionPlanner(openai_client)
        self.executor = ToolExecutor(browser_service)
        
    def run(self, goal: str, max_steps: int = 10) -> Dict[str, Any]:
        """
        Run the agent loop.
        """
        state = AgentState()
        steps = 0
        
        logger.info(f"Starting CUA Agent run for goal: {goal}")
        
        while steps < max_steps:
            # 1. Decide
            action = self.planner.decide(state, goal)
            
            # 2. Check termination
            if action.get('type') == 'done':
                logger.info("Agent decided it is done.")
                return {"status": "success", "result": action.get('reason')}
            
            # 3. Execute
            try:
                result = self.executor.execute(action)
            except Exception as e:
                logger.error(f"Action execution failed: {e}")
                result = f"Error: {str(e)}"
            
            # 4. Update State
            state.update_history(action, result)
            steps += 1
            
        return {"status": "timeout", "steps": steps}
