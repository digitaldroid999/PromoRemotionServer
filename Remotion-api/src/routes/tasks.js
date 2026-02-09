import express from 'express';
import { getTask, getAllTasks } from '../utils/taskManager.js';

const router = express.Router();

// Get task status by ID
router.get('/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const task = await getTask(taskId);
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    res.json(task);
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ error: 'Failed to fetch task', details: error.message });
  }
});

// Get all tasks (optional: for debugging/admin)
router.get('/', async (req, res) => {
  try {
    const tasks = await getAllTasks();
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks', details: error.message });
  }
});

export default router;
