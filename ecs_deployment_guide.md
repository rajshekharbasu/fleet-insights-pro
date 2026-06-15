# 🚀 The Ultimate AWS ECS Deployment Guide (Frontend Edition)

Welcome to your step-by-step guide to deploying your frontend application ("Site Readiness") to AWS! We will be using **AWS ECS (Elastic Container Service)** with **Fargate**, which is the absolute industry-standard for running Docker containers securely and at scale without managing physical servers.

---

## 1. Basic Concepts (The Vocabulary)

Before typing any commands, let's understand the landscape:

* **Docker Image**: A packaged, read-only template containing your application code, runtime (Node.js/Nginx), and libraries. Think of it as a blueprint.
* **Container**: A running instance of your Docker Image. It's the actual live application process.
* **Amazon ECR (Elastic Container Registry)**: AWS's version of Docker Hub. It's a secure, private locker where you upload your Docker Images.
* **ECS Cluster**: A logical grouping of your containers. It's like a virtual data center where your apps live.
* **Fargate**: A serverless compute engine for containers. Instead of you creating EC2 servers and installing Docker on them, Fargate simply says, "Give me a container, and I'll run it in the background." No server maintenance needed!
* **Task Definition**: The instruction manual for your container. It tells ECS: "Use this image from ECR, give it 1GB of RAM, 0.5 CPU, open port 3000, and inject these environment variables."
* **ECS Service**: The manager that ensures your Task Definition stays running. If you tell the Service "I always want 2 containers running," and one crashes, the Service will automatically spin up a new one.
* **Target Group (TG)**: A logical group that keeps track of the IP addresses of your running containers.
* **Application Load Balancer (ALB)**: The front door to your app. It receives traffic from the internet and distributes it evenly to the containers in your Target Group.
* **Security Group (SG)**: A virtual firewall. You'll need one for the ALB (allow port 80/443 from anywhere) and one for your ECS containers (only allow traffic coming *from* the ALB).
* **IAM Role**: Permissions. Your ECS Task needs a role (TaskExecutionRole) to allow it to pull images from ECR and push logs to CloudWatch.
* **CloudWatch Logs**: Where all the `console.log` and error outputs from your container are sent.

---

## 2. Pre-deployment Checklist

Before building your Docker image, verify your local code:

1. **Check build command**: Does `npm run build` or `vite build` complete successfully without errors?
2. **Check port mapping**: Determine which port your app runs on in production (e.g., 3000 for Node, 80 for Nginx).
3. **Environment Variables**: Make sure your `.env` variables are handled. Remember: **Never hardcode secrets into the frontend build**. Your `VITE_API_BASE_URL` should point to your backend's production URL.
4. **Health Check Path**: The Load Balancer needs a path to constantly ping to ensure the app is alive. For a frontend app, pinging `/` (the homepage) is usually sufficient.

---

## 3. Docker Setup

For modern full-stack frontend frameworks (like TanStack Start or Next.js), you need a Node.js runtime to handle SSR (Server-Side Rendering).

### Create a `Dockerfile`
Create a file named `Dockerfile` in the root of your `fleet-insights-pro` directory:

```dockerfile
# Stage 1: Build the app
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# Set production environment variable for build time
ENV NODE_ENV=production
RUN npm run build

# Stage 2: Run the app
FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
# If you use a custom output directory like .output, copy that instead!

EXPOSE 3000
CMD ["npm", "run", "start"]
```
*(Note: Adjust the `CMD` to match your production start command, e.g., `npm run start` or `node server.js`)*

### Test Locally
Before going to AWS, verify it works on your machine:
```bash
# Build the image
docker build -t site-readiness-frontend .

# Run the image locally on port 3000
docker run -p 3000:3000 --env-file .env.local site-readiness-frontend
```
Open `http://localhost:3000` in your browser. If it loads, you are ready for AWS!

---

## 4. AWS Deployment Steps (with CLI)

Make sure you have the AWS CLI installed and configured (`aws configure`) with Administrator permissions.

### Step A: Push Image to ECR
```bash
# 1. Create a private ECR repository
aws ecr create-repository --repository-name site-readiness-frontend

# 2. Get the login password and authenticate Docker to your ECR registry
# Replace <REGION> and <ACCOUNT_ID> with your AWS region and Account ID
aws ecr get-login-password --region <REGION> | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com

# 3. Tag your local image with the ECR URI
docker tag site-readiness-frontend:latest <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/site-readiness-frontend:latest

# 4. Push the image to ECR
docker push <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/site-readiness-frontend:latest
```

### Step B: Create ECS Cluster
```bash
aws ecs create-cluster --cluster-name siteops-production-cluster
```

### Step C: Create a Task Execution IAM Role
ECS needs permission to pull the image and push logs. (If you use the AWS Console, this is created automatically. Via CLI, you must create it).
*Skip this if `ecsTaskExecutionRole` already exists in your AWS account.*

### Step D: Register Task Definition
Create a file named `task-def.json`:
```json
{
  "family": "site-readiness-frontend-task",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::<ACCOUNT_ID>:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "frontend-container",
      "image": "<ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/site-readiness-frontend:latest",
      "portMappings": [{ "containerPort": 3000, "protocol": "tcp" }],
      "environment": [
        { "name": "VITE_API_BASE_URL", "value": "https://api.transvolt.org" }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/site-readiness-frontend",
          "awslogs-region": "<REGION>",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```
Run:
```bash
aws ecs register-task-definition --cli-input-json file://task-def.json
```

### Step E: Networking Setup (Load Balancer & Target Group)
*It is highly recommended to do this step in the AWS Console UI because linking VPCs and Subnets via CLI is prone to errors.*
1. Go to EC2 -> **Target Groups**. Create a target group named `frontend-tg`. Target type: **IP**. Port: 3000. Protocol: HTTP. Health check path: `/`.
2. Go to EC2 -> **Load Balancers**. Create an Application Load Balancer (ALB). Name it `siteops-frontend-alb`. Set listeners to HTTP (Port 80) and forward it to `frontend-tg`. 
3. **Security Groups**: 
   - ALB Security Group: Allow inbound HTTP/HTTPS from `0.0.0.0/0`.
   - ECS Security Group: Allow inbound Port 3000 **ONLY** from the ALB Security Group.

### Step F: Create ECS Service
Once the Target Group exists, create the service.
Create `service-def.json`:
```json
{
    "cluster": "siteops-production-cluster",
    "serviceName": "frontend-service",
    "taskDefinition": "site-readiness-frontend-task",
    "desiredCount": 1,
    "launchType": "FARGATE",
    "networkConfiguration": {
        "awsvpcConfiguration": {
            "subnets": ["subnet-xyz1", "subnet-xyz2"],
            "securityGroups": ["sg-ecsSecurityGroup"],
            "assignPublicIp": "ENABLED"
        }
    },
    "loadBalancers": [
        {
            "targetGroupArn": "arn:aws:elasticloadbalancing:<REGION>:<ACCOUNT_ID>:targetgroup/frontend-tg/...",
            "containerName": "frontend-container",
            "containerPort": 3000
        }
    ]
}
```
Run:
```bash
aws ecs create-service --cli-input-json file://service-def.json
```
Your app is now deploying! Copy the DNS Name of your Load Balancer and paste it into your browser.

---

## 5. Production Checks & Debugging Guide

When things go wrong, here is how you fix them:

> [!WARNING]
> **502 Bad Gateway / 503 Service Temporarily Unavailable**
> **Cause**: The Load Balancer cannot reach your container.
> **Fix**: 
> 1. Check your ECS Service "Events" tab. Is the task constantly starting and stopping?
> 2. Check the Target Group Health Checks. Are they failing? If your app takes 30 seconds to boot but the health check times out after 5 seconds, it will kill the container. Increase the health check timeout/grace period.
> 3. Check your Security Groups. Does the ECS SG allow port 3000 traffic from the ALB SG?

> [!IMPORTANT]
> **Task Stopped Reason: "Essential container in task exited"**
> **Cause**: Your application crashed immediately upon startup.
> **Fix**: Go to **CloudWatch Logs** -> Log Groups -> `/ecs/site-readiness-frontend`. Look at the exact error. It is usually a missing Environment Variable or a syntax error in your production build.

> [!TIP]
> **Frontend API URL or CORS Issues**
> **Cause**: The frontend is trying to call `http://localhost:8000` in production.
> **Fix**: Frontend environment variables (like `VITE_API_BASE_URL`) must be injected at **build time**, not runtime! If you inject them in the ECS Task Definition, the browser won't see them because Vite bundles them into static HTML/JS files during `npm run build`. You must pass build arguments in your Dockerfile or build the image with the correct `.env.production` file before pushing to ECR.

---

## 6. Final Deployment Checklist (For the Team)

Before telling your team "Deployment is complete," verify these items:
- [ ] **Docker Image**: The image was built successfully and runs locally.
- [ ] **ECR**: The image is visible in the AWS ECR console.
- [ ] **ECS Task Status**: The task is in a `RUNNING` state in the ECS console (not continuously flapping between PENDING and STOPPED).
- [ ] **Target Group Health**: The targets inside the Target Group are showing as `Healthy`.
- [ ] **Load Balancer DNS**: Accessing the ALB's DNS name in an incognito window successfully loads the site.
- [ ] **API Connectivity**: Clicking a button on the deployed frontend successfully communicates with the backend (no CORS or localhost errors).
- [ ] **Logs**: CloudWatch logs are flowing in and show no startup crashes.
