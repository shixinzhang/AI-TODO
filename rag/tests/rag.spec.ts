import { test, expect } from '@playwright/test';
import path from 'path';

test('RAG Application End-to-End Test', async ({ page }) => {
  // 1. Navigate to the homepage
  await page.goto('http://localhost:4000');
  
  // 2. Verify page title
  await expect(page).toHaveTitle(/Teacher Profile RAG/);
  await expect(page.getByRole('heading', { name: 'Teacher Profile RAG' })).toBeVisible();

  // 3. Upload a document (products.csv)
  const fileInput = page.locator('input[type="file"]');
  const filePath = path.join(process.cwd(), 'demo-data/products.csv');
  await fileInput.setInputFiles(filePath);

  // 4. Verify upload success message (wait for it to appear)
  // The app displays "Success: ..." in a paragraph
  await expect(page.getByText(/Success:/)).toBeVisible({ timeout: 30000 });
  
  // 5. Interact with Chat
  // Test Suggestion Chips
  const suggestion = page.getByRole('button', { name: '推荐一款降噪耳机' });
  await expect(suggestion).toBeVisible();
  await suggestion.click();
  
  // input filling is not needed when clicking suggestion, as it sends immediately
  // const input = page.locator('input[type="text"]');
  // await input.fill('有降噪耳机吗？');
  
  // Click the submit button inside the form
  // await page.locator('button[type="submit"]').click();

  // 6. Verify response
  // Assistant message usually has a specific class or we can look for text
  // The mocked RAG should return an answer based on products.csv
  // Since we are using a real LLM (Doubao), the response will vary but should contain relevant info.
  // We just check if a new message from assistant appears.
  // Initial state has 0 messages or a greeting.
  // We look for a message that is not the greeting.
  
  // Wait for "Thinking..." to disappear (if it appeared) or just wait for response
  // await expect(page.getByText('Thinking...')).toBeVisible(); 
  // await expect(page.getByText('Thinking...')).toBeHidden({ timeout: 60000 });

  // Check if there is a response
  // We expect "Mock Mode" text in the response
  // await expect(page.getByText(/Mock Mode/)).toBeVisible({ timeout: 10000 });
  
  // Wait for any assistant message
  const messages = page.getByTestId('assistant-message');
  await expect(messages.count()).resolves.toBeGreaterThan(0);
  
  // Log the content for debugging
  const lastMessage = messages.last();
  console.log('Last message content:', await lastMessage.textContent());
  await expect(lastMessage).toContainText('Mock Mode');
  
});
