// 测试文章点赞收藏功能的脚本
const testArticleLikeBookmark = async () => {
  try {
    // 1. 获取文章列表
    console.log('1. 获取文章列表...');
    const articlesResponse = await fetch('/api/recommend?contentType=article');
    const articlesData = await articlesResponse.json();
    console.log('文章数量:', articlesData.recommendations?.length);
    
    if (!articlesData.recommendations?.length) {
      console.error('没有找到文章');
      return;
    }
    
    const firstArticle = articlesData.recommendations[0];
    console.log('测试文章:', firstArticle.title, 'ID:', firstArticle._id);
    
    // 2. 测试点赞功能
    console.log('2. 测试点赞功能...');
    const likeResponse = await fetch('/api/cases/like', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recordId: firstArticle._id,
        contentType: 'article'
      })
    });
    
    const likeResult = await likeResponse.json();
    console.log('点赞结果:', likeResult);
    
    // 3. 测试收藏功能
    console.log('3. 测试收藏功能...');
    const bookmarkResponse = await fetch('/api/cases/bookmark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recordId: firstArticle._id,
        contentType: 'article'
      })
    });
    
    const bookmarkResult = await bookmarkResponse.json();
    console.log('收藏结果:', bookmarkResult);
    
  } catch (error) {
    console.error('测试失败:', error);
  }
};

// 在浏览器控制台中运行测试
console.log('请在登录后在浏览器控制台运行: testArticleLikeBookmark()');
window.testArticleLikeBookmark = testArticleLikeBookmark;