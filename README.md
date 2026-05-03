# Assignment: Team Task Manager (Full-Stack)

**App Name:** TaskFlow  
**Live Deployment:** https://team-task-manager-balaji.up.railway.app

This repository contains my submission for the Full-Stack Team Task Manager assignment. It is a complete web application built to allow users to create projects, assign tasks, and track progress with strict role-based access control.

## 🚀 Key Features Implemented

- **Authentication:** Secure signup and login flow using JWT (JSON Web Tokens) and bcrypt password hashing.
- **Project & Team Management:** Users can create new projects and add team members.
- **Task Tracking:** Ability to create tasks, assign them to specific members, set priorities, and update status via a Kanban-style board (Todo → In Progress → Review → Done).
- **Interactive Dashboard:** A main dashboard that displays task statistics, overdue warnings, and a status breakdown.

## ⚙️ Requirements Fulfilled

- **REST APIs + Database:** Built a robust Node.js/Express backend exposing RESTful APIs. Data is stored in a relational **MySQL** database.
- **Validations & Relationships:** 
  - Backend validation using `express-validator`.
  - Database schema includes proper primary/foreign key relationships (Users ↔ Projects ↔ Tasks).
- **Role-Based Access Control:** 
  - Two distinct roles: **Admin** and **Member**.
  - Admins can manage projects and team members. Members can only view their projects and update assigned tasks.

## 🌐 Deployment (Mandatory)

The application is deployed, live, and fully functional using **Railway**.

- **Frontend & Backend:** Hosted as a Node.js web service on Railway.
- **Database:** Uses a provisioned Railway MySQL database.

---

### Running the Project Locally

If you wish to test the code locally:

1. Clone the repository and run `npm install`.
2. Create a `.env` file with your local MySQL credentials:
   ```env
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=task_team_manager
   JWT_SECRET=super_secret_key
   ```
3. Initialize the database schema by running `node server/database/setup.js`.
4. Start the server with `npm start`.
5. Open `http://localhost:5000` in your browser.
