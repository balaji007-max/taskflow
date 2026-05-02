-- ============================================================
-- Task Team Manager - MySQL Database Schema
-- ============================================================

CREATE DATABASE IF NOT EXISTS task_team_manager 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

USE task_team_manager;

-- ============================================================
-- USERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id          VARCHAR(36)  NOT NULL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(150) NOT NULL UNIQUE,
  password    VARCHAR(255) NOT NULL,
  role        ENUM('admin', 'member') NOT NULL DEFAULT 'member',
  avatar      VARCHAR(10)  DEFAULT NULL,      -- emoji avatar
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- PROJECTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS projects (
  id          VARCHAR(36)   NOT NULL PRIMARY KEY,
  name        VARCHAR(150)  NOT NULL,
  description TEXT          DEFAULT NULL,
  owner_id    VARCHAR(36)   NOT NULL,
  status      ENUM('active','archived') NOT NULL DEFAULT 'active',
  deadline    DATE          DEFAULT NULL,
  color       VARCHAR(20)   DEFAULT '#6366f1',
  created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_project_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- PROJECT MEMBERS TABLE (many-to-many)
-- ============================================================
CREATE TABLE IF NOT EXISTS project_members (
  id         VARCHAR(36)                    NOT NULL PRIMARY KEY,
  project_id VARCHAR(36)                    NOT NULL,
  user_id    VARCHAR(36)                    NOT NULL,
  role       ENUM('admin','member')         NOT NULL DEFAULT 'member',
  joined_at  DATETIME                       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_project_member (project_id, user_id),
  CONSTRAINT fk_pm_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_pm_user    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TASKS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
  id           VARCHAR(36)  NOT NULL PRIMARY KEY,
  project_id   VARCHAR(36)  NOT NULL,
  title        VARCHAR(200) NOT NULL,
  description  TEXT         DEFAULT NULL,
  status       ENUM('todo','in_progress','review','done') NOT NULL DEFAULT 'todo',
  priority     ENUM('low','medium','high','critical')     NOT NULL DEFAULT 'medium',
  assigned_to  VARCHAR(36)  DEFAULT NULL,
  created_by   VARCHAR(36)  NOT NULL,
  due_date     DATE         DEFAULT NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_task_project  FOREIGN KEY (project_id)  REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_task_assignee FOREIGN KEY (assigned_to) REFERENCES users(id)    ON DELETE SET NULL,
  CONSTRAINT fk_task_creator  FOREIGN KEY (created_by)  REFERENCES users(id)    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- TASK COMMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS task_comments (
  id         VARCHAR(36) NOT NULL PRIMARY KEY,
  task_id    VARCHAR(36) NOT NULL,
  user_id    VARCHAR(36) NOT NULL,
  content    TEXT        NOT NULL,
  created_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_comment_task FOREIGN KEY (task_id) REFERENCES tasks(id)  ON DELETE CASCADE,
  CONSTRAINT fk_comment_user FOREIGN KEY (user_id) REFERENCES users(id)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- ACTIVITY LOG TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_log (
  id         VARCHAR(36)  NOT NULL PRIMARY KEY,
  user_id    VARCHAR(36)  DEFAULT NULL,
  project_id VARCHAR(36)  DEFAULT NULL,
  task_id    VARCHAR(36)  DEFAULT NULL,
  action     VARCHAR(100) NOT NULL,
  details    TEXT         DEFAULT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_activity_user    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE SET NULL,
  CONSTRAINT fk_activity_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
  CONSTRAINT fk_activity_task    FOREIGN KEY (task_id)    REFERENCES tasks(id)    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- INDEXES for performance
-- ============================================================
CREATE INDEX idx_tasks_project    ON tasks(project_id);
CREATE INDEX idx_tasks_assigned   ON tasks(assigned_to);
CREATE INDEX idx_tasks_status     ON tasks(status);
CREATE INDEX idx_tasks_due_date   ON tasks(due_date);
CREATE INDEX idx_pm_user          ON project_members(user_id);
CREATE INDEX idx_activity_user    ON activity_log(user_id);
CREATE INDEX idx_activity_project ON activity_log(project_id);
