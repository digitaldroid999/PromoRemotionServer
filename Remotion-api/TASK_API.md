# Task-Based Video Generation API

## Overview

The video generation now uses an asynchronous task-based system. Instead of waiting for the entire video to be generated, you get a task ID immediately and can poll for status updates.

## API Endpoints

### 1. Create Video Generation Task

**POST** `/videos`

Creates a new video generation task and returns a task ID immediately.

**Request Body:**
```json
{
  "template": "product-modern-v1",
  "imageUrl": "https://example.com/product.jpg",
  "product": {
    "title": "Product Name",
    "price": "$99.99",
    "rating": 4.5
  }
}
```

**Available Templates:**
- `product-modern-v1` - Modern product hero style
- `product-minimal-v1` - Minimal social proof style

**Response:**
```json
{
  "taskId": "task_1234567890_abc123",
  "status": "pending",
  "message": "Video generation started. Use /tasks/:taskId to check status."
}
```

---

### 2. Get Task Status

**GET** `/tasks/:taskId`

Check the current status of a video generation task.

**Response (Pending/Processing):**
```json
{
  "id": "task_1234567890_abc123",
  "status": "processing",
  "stage": "rendering",
  "progress": 50,
  "template": "productShowcase",
  "imageUrl": "https://example.com/product.jpg",
  "product": { ... },
  "createdAt": "2024-01-01T12:00:00.000Z",
  "updatedAt": "2024-01-01T12:05:00.000Z"
}
```

**Response (Completed):**
```json
{
  "id": "task_1234567890_abc123",
  "status": "completed",
  "stage": "done",
  "progress": 100,
  "videoUrl": "https://supabase.storage/video.mp4",
  "template": "product-modern-v1",
  "imageUrl": "https://example.com/product.jpg",
  "product": { ... },
  "createdAt": "2024-01-01T12:00:00.000Z",
  "updatedAt": "2024-01-01T12:10:00.000Z"
}
```

**Response (Failed):**
```json
{
  "id": "task_1234567890_abc123",
  "status": "failed",
  "stage": "error",
  "error": "Error message here",
  "template": "product-modern-v1",
  "createdAt": "2024-01-01T12:00:00.000Z",
  "updatedAt": "2024-01-01T12:05:00.000Z"
}
```

---

### 3. Get All Tasks (Optional)

**GET** `/tasks`

Get all tasks (useful for debugging or admin purposes).

**Response:**
```json
{
  "task_1234567890_abc123": { ... },
  "task_0987654321_xyz789": { ... }
}
```

---

## Task Lifecycle

1. **pending** → Task created, waiting to start
   - Stage: `queued`
   - Progress: 0%

2. **processing** → Video generation in progress
   - Stage: `bundling` (Progress: 10%)
   - Stage: `rendering` (Progress: 30%)
   - Stage: `uploading` (Progress: 80%)

3. **completed** → Video ready
   - Stage: `done`
   - Progress: 100%
   - Contains `videoUrl` field

4. **failed** → Error occurred
   - Stage: `error`
   - Contains `error` field

---

## Example Usage (JavaScript)

```javascript
// Step 1: Create task
const response = await fetch('http://localhost:5050/videos', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    template: 'product-modern-v1',
    imageUrl: 'https://example.com/product.jpg',
    product: {
      title: 'Test Product',
      price: '$99.99',
      rating: 4.5
    }
  })
});

const { taskId } = await response.json();

// Step 2: Poll for status
const pollStatus = async () => {
  const statusResponse = await fetch(`http://localhost:5050/tasks/${taskId}`);
  const task = await statusResponse.json();
  
  console.log(`Status: ${task.status}, Progress: ${task.progress}%`);
  
  if (task.status === 'completed') {
    console.log('Video ready:', task.videoUrl);
    return task.videoUrl;
  } else if (task.status === 'failed') {
    throw new Error(task.error);
  } else {
    // Still processing, check again in 5 seconds
    setTimeout(pollStatus, 5000);
  }
};

pollStatus();
```

---

## Data Storage

Tasks are stored in a JSON file at `data/tasks.json`. This is a simple file-based approach suitable for development and small-scale production.

For production at scale, consider migrating to a database (PostgreSQL, MongoDB, Redis, etc.).

---

## Testing

Run the test script to see the task-based API in action:

```bash
node test-task-api.js
```
