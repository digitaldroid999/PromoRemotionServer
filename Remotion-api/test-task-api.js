// Test script for task-based video generation API

const API_BASE = 'http://localhost:5050';

async function testTaskBasedGeneration() {
  console.log('🧪 Testing Task-Based Video Generation\n');

  // Step 1: Start video generation
  console.log('Step 1: Starting video generation...');
  const generateResponse = await fetch(`${API_BASE}/videos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      template: 'product-modern-v1',
      imageUrl: 'https://m.media-amazon.com/images/I/71dp-iVWrLL._AC_SX575_.jpg',
      product: {
        title: 'Test Product',
        price: '$99.99',
        rating: 4.5,
      },
    }),
  });

  const generateResult = await generateResponse.json();
  console.log('Response:', generateResult);
  
  if (!generateResult.taskId) {
    console.error('❌ Failed to get task ID');
    return;
  }

  const taskId = generateResult.taskId;
  console.log(`✅ Task created: ${taskId}\n`);

  // Step 2: Poll task status
  console.log('Step 2: Polling task status...\n');
  
  let isComplete = false;
  let attempts = 0;
  const maxAttempts = 60; // 5 minutes max (5s interval)

  while (!isComplete && attempts < maxAttempts) {
    attempts++;
    
    // Wait 5 seconds before checking
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const statusResponse = await fetch(`${API_BASE}/tasks/${taskId}`);
    const taskStatus = await statusResponse.json();
    
    console.log(`[${new Date().toLocaleTimeString()}] Status: ${taskStatus.status} | Stage: ${taskStatus.stage} | Progress: ${taskStatus.progress || 0}%`);
    
    if (taskStatus.status === 'completed') {
      isComplete = true;
      console.log('\n✅ Video generation completed!');
      console.log('Video URL:', taskStatus.videoUrl);
    } else if (taskStatus.status === 'failed') {
      isComplete = true;
      console.log('\n❌ Video generation failed!');
      console.log('Error:', taskStatus.error);
    }
  }

  if (attempts >= maxAttempts) {
    console.log('\n⏱️  Timeout: Video generation took too long');
  }
}

// Run test
testTaskBasedGeneration().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
