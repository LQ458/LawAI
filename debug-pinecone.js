const { Pinecone } = require('@pinecone-database/pinecone');

async function debugPinecone() {
  try {
    const pc = new Pinecone({ 
      apiKey: 'pcsk_3YVYSv_UDm3bH5ZxdEaoHD5xwcKPcXDP69BcMFkgQV9KiiLGxXni2zPzZPJ4AQ8hQ7ucn4'
    });

    const index = pc.index("finalindex", 'https://finalindex-bc20h85.svc.aped-4627-b74a.pinecone.io');
    const namespace = index.namespace("caselist");

    console.log('=== 调试Pinecone数据 ===');
    
    // 检查索引统计
    const stats = await index.describeIndexStats();
    console.log('索引统计:', stats);
    
    // 使用测试向量查询
    const testVector = new Array(1536).fill(0.1);
    const queryResponse = await namespace.query({
      vector: testVector,
      topK: 10,
      includeValues: false,
      includeMetadata: true,
    });
    
    console.log('\n=== 查询结果 ===');
    console.log(`找到 ${queryResponse.matches.length} 个结果`);
    
    queryResponse.matches.forEach((match, i) => {
      console.log(`\n结果 ${i + 1}:`);
      console.log(`ID: ${match.id}`);
      console.log(`分数: ${match.score}`);
      console.log(`元数据:`, match.metadata);
    });
    
    // 过滤高相似度结果
    const filteredMatches = queryResponse.matches.filter(match => (match.score || 0) >= 0.3);
    console.log(`\n过滤后 (相似度>=0.3): ${filteredMatches.length} 个结果`);
    
  } catch (error) {
    console.error('Pinecone调试失败:', error.message);
  }
}

debugPinecone();