import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TASKS_FILE = path.join(__dirname, '../../data/tasks.json');

// Queue for file operations to prevent race conditions
let fileOperationQueue = Promise.resolve();

// Ensure data directory exists
async function ensureDataDir() {
  const dataDir = path.dirname(TASKS_FILE);
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

// Load all tasks from JSON file
async function loadTasks() {
  try {
    await ensureDataDir();
    const data = await fs.readFile(TASKS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {};
    }
    // If JSON is corrupted, log error and return empty object
    if (error instanceof SyntaxError) {
      console.error('⚠️  Corrupted tasks.json file detected, resetting...');
      return {};
    }
    throw error;
  }
}

// Save all tasks to JSON file (with queue to prevent race conditions)
async function saveTasks(tasks) {
  // Queue the operation to prevent concurrent writes
  fileOperationQueue = fileOperationQueue.then(async () => {
    await ensureDataDir();
    await fs.writeFile(TASKS_FILE, JSON.stringify(tasks, null, 2), 'utf-8');
  });
  
  return fileOperationQueue;
}

// Create a new task
export async function createTask(taskData) {
  const tasks = await loadTasks();
  const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  tasks[taskId] = {
    id: taskId,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...taskData,
  };
  
  await saveTasks(tasks);
  return tasks[taskId];
}

// Update task status
export async function updateTask(taskId, updates) {
  const tasks = await loadTasks();
  
  if (!tasks[taskId]) {
    throw new Error(`Task ${taskId} not found`);
  }
  
  tasks[taskId] = {
    ...tasks[taskId],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  
  await saveTasks(tasks);
  return tasks[taskId];
}

// Get task by ID
export async function getTask(taskId) {
  const tasks = await loadTasks();
  return tasks[taskId] || null;
}

// Get all tasks (optional: for admin/debugging)
export async function getAllTasks() {
  return await loadTasks();
}

// Delete old completed tasks (cleanup utility)
export async function cleanupOldTasks(daysOld = 7) {
  const tasks = await loadTasks();
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  
  let cleaned = 0;
  for (const [taskId, task] of Object.entries(tasks)) {
    if (task.status === 'completed' || task.status === 'failed') {
      const taskDate = new Date(task.updatedAt);
      if (taskDate < cutoffDate) {
        delete tasks[taskId];
        cleaned++;
      }
    }
  }
  
  if (cleaned > 0) {
    await saveTasks(tasks);
  }
  
  return cleaned;
}
