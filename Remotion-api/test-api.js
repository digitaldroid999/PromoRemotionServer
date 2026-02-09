
const API_URL = process.env.API_URL || 'http://localhost:5050';

async function testHealthCheck() {
  console.log('\n📋 Testing health check endpoint...');
  try {
    const response = await fetch(`${API_URL}/health`);
    const data = await response.json();
    console.log('✅ Health check passed:', data);
    return true;
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    return false;
  }
}

async function testVideoGeneration(imageUrl, template, productData) {
  console.log(`\n🎬 Testing video generation with template: ${template}`);
  
  try {
    console.log('📤 Sending request...');
    console.log('Image URL:', imageUrl);
    console.log('Product data:', JSON.stringify(productData, null, 2));

    const response = await fetch(`${API_URL}/videos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        imageUrl,
        template,
        product: productData
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Video generation failed:', errorData);
      return false;
    }

    const result = await response.json();
    console.log('✅ Video generated successfully!');
    console.log('Video URL:', result.videoUrl);
    return true;
  } catch (error) {
    console.error('❌ Video generation failed:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Starting API tests...');
  console.log(`API URL: ${API_URL}`);

  // Test 1: Health check
  const healthCheckPassed = await testHealthCheck();
  if (!healthCheckPassed) {
    console.log('\n❌ API is not running. Please start the server first with: npm start');
    process.exit(1);
  }

  // Test 2: Video generation with ProductHero template
  const sampleImageUrl = "https://m.media-amazon.com/images/I/71dp-iVWrLL._AC_SX575_.jpg";
  
  const productHeroData = {
    title: "Premium Wireless Headphones",
    price: "$199.99",
    rating: 4.8
  };

  const test1Passed = await testVideoGeneration(
    sampleImageUrl,
    'product-modern-v1',
    productHeroData
  );

  // Test 3: Video generation with FullScreenSocialProof template
  const fullScreenData = {
    title: "PREMIUM WIRELESS HEADPHONES",
    originalPrice: "$99.00",
    salePrice: "$59.00",
    rating: 4.8,
    reviewCount: 2341,
    reviews: [
      "🔥 BEST PURCHASE THIS YEAR!",
      "DIDN'T EXPECT THIS QUALITY!",
      "WORTH EVERY DOLLAR.",
      "SOUND QUALITY IS UNREAL.",
      "PERFECT FOR DAILY COMMUTE."
    ]
  };

  const test2Passed = await testVideoGeneration(
    sampleImageUrl,
    'product-minimal-v1',
    fullScreenData
  );

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Summary:');
  console.log('='.repeat(50));
  console.log(`Health Check: ${healthCheckPassed ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`ProductHero Template: ${test1Passed ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`FullScreenSocialProof Template: ${test2Passed ? '✅ PASSED' : '❌ FAILED'}`);
  console.log('='.repeat(50));

  const allPassed = healthCheckPassed && test1Passed && test2Passed;
  if (allPassed) {
    console.log('\n🎉 All tests passed!');
  } else {
    console.log('\n⚠️ Some tests failed. Check the logs above for details.');
  }
}

// Run tests
runTests().catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});
