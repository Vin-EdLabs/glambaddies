UPDATE product_images SET url = CASE product_id
  WHEN 1  THEN 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1200&q=85'
  WHEN 2  THEN 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=85'
  WHEN 3  THEN 'https://images.unsplash.com/photo-1608043152269-423dbba4b7c1?auto=format&fit=crop&w=1200&q=85'
  WHEN 4  THEN 'https://images.unsplash.com/photo-1583863788434-e58a36338f94?auto=format&fit=crop&w=1200&q=85'
  WHEN 5  THEN 'https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=1200&q=85'
  WHEN 6  THEN 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1200&q=85'
  WHEN 7  THEN 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=85'
  WHEN 8  THEN 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=85'
  WHEN 9  THEN 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&w=1200&q=85'
  WHEN 10 THEN 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=1200&q=85'
  WHEN 11 THEN 'https://images.unsplash.com/photo-1620916297397-a4a3372a4c9c?auto=format&fit=crop&w=1200&q=85'
  WHEN 12 THEN 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?auto=format&fit=crop&w=1200&q=85'
  WHEN 13 THEN 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=85'
  WHEN 14 THEN 'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?auto=format&fit=crop&w=1200&q=85'
END
WHERE product_id BETWEEN 1 AND 14;
