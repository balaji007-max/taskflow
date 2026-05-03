# TaskFlow

A team task management web app I built for managing projects and tracking tasks across teams. It has role-based access so admins and members have different levels of control.

## What it does

- Sign up / login with JWT authentication
- Create projects and add team members
- Assign tasks with priorities and due dates
- Kanban board to move tasks across stages (Todo → In Progress → Review → Done)
- Dashboard showing your tasks, overdue items, and recent activity
- Admins can manage users and control who has access to what

## Tech used

- **Backend** – Node.js, Express
- **Database** – MySQL
- **Auth** – JWT + bcrypt
- **Frontend** – Vanilla HTML, CSS, JavaScript (no frameworks)
- **Deployed on** – Railway

## Running it locally

Clone the repo and install dependencies:

```
npm install
```

Set up your `.env` file:

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=task_team_manager
JWT_SECRET=any_secret_key
```

Create the database tables:

```
node server/database/setup.js
```

Start the server:

```
npm start
```

Then open `http://localhost:5000` in your browser.

## Roles

There are two roles — **Admin** and **Member**.

Admins can create projects, manage members, assign tasks to anyone, and delete things. Members can view their assigned projects, create tasks, update task status, and leave comments.

## Live demo

https://team-task-manager-balaji.up.railway.app
