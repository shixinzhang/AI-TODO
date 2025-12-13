-- Supabase 数据库表结构
-- 在 Supabase Dashboard 的 SQL Editor 中执行此 SQL 来创建 tasks 表

CREATE TABLE IF NOT EXISTS tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  completed BOOLEAN DEFAULT false NOT NULL,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')) NOT NULL,
  due_date TIMESTAMPTZ,
  parent_id UUID REFERENCES tasks(id) ON DELETE CASCADE,  -- 父任务 ID，支持子任务层级关系
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks(parent_id);  -- 用于快速查询子任务

-- 创建更新时间触发器（可选，但推荐）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 启用 Row Level Security (RLS) - 根据需要调整策略
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- 示例策略：允许所有操作（根据你的需求调整）
-- 注意：在生产环境中，你应该设置更严格的策略
CREATE POLICY "Allow all operations" ON tasks
  FOR ALL
  USING (true)
  WITH CHECK (true);


