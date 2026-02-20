import express from 'express';
import { getTask, getAllTasks } from '../utils/taskManager.js';

const router = express.Router();

// Get task status by ID
router.get('/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    console.log(`📥 [REQUEST] GET /tasks/${taskId}`);
    
    const task = await getTask(taskId);
    
    if (!task) {
      const errorResponse = { error: 'Task not found' };
      console.log('❌ [RESPONSE] 404:', errorResponse);
      return res.status(404).json(errorResponse);
    }
    
    console.log('✅ [RESPONSE] 200:', JSON.stringify(task, null, 2));
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.json(task);
  } catch (error) {
    console.error('Error fetching task:', error);
    const errorResponse = { error: 'Failed to fetch task', details: error.message };
    console.log('❌ [RESPONSE] 500:', errorResponse);
    res.status(500).json(errorResponse);
  }
});

// Get all tasks (optional: for debugging/admin)
router.get('/', async (req, res) => {
  try {
    console.log('📥 [REQUEST] GET /tasks');
    
    const tasks = await getAllTasks();
    
    console.log(`✅ [RESPONSE] 200: ${tasks.length} tasks found`);
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    const errorResponse = { error: 'Failed to fetch tasks', details: error.message };
    console.log('❌ [RESPONSE] 500:', errorResponse);
    res.status(500).json(errorResponse);
  }
});

export default router;
