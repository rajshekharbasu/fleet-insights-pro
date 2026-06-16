# 🏛️ AWS ECS Masterclass: From Zero to Principal Engineer

Welcome. As a Principal AWS DevOps Architect, my goal isn't just to give you commands to copy-paste. My goal is to teach you *how to think* about cloud architecture, how to discover what already exists, and how to confidently deploy your frontend application into a production environment. 

We will break this down into 5 phases. Let's begin.

---

## 🏗️ Phase 1: Infrastructure Discovery

Before we build the new roof (the frontend), we must inspect the foundation (the existing AWS setup). You need to log into the AWS Console and perform a systematic discovery.

### 1. VPC & Subnets (The Networkx`)
* **Where to click:** Search for **VPC** -> Click **Your VPCs** -> Click **Subnets**.
* **What you should see:** A list of VPCs and Subnets (e.g., `public-subnet-1`, `private-subnet-1`).1`
* **What to collect:** Note the VPC ID. Identify which subnets are *Public* (have a route to an Internet Gateway) and which are *Private* (route to a NAT Gateway).
* **Why it matters:** Your Load Balancer must go in Public subnets to be reached from the internet. Your ECS Fargate tasks should ideally go in Private subnets for security.

### 2. ECS Clusters (The Compute Environment)
* **Where to click:** Search for **Elastic Container Service** -> Click **Clusters**.
* **What you should see:** A list of clusters (e.g., `dev-cluster`, `prod-cluster`).
* **What to collect:** Click the cluster your backend runs in. Note the cluster name.
* **Why it matters:** We need to know if we should deploy the frontend into this same cluster (common for cost-saving in DEV) or a separate one.

### 3. Load Balancers & Target Groups (The Front Door)
* **Where to click:** Search for **EC2** -> Scroll down left menu to **Load Balancers** and **Target Groups**.
* **What you should see:** An Application Load Balancer (ALB) and Target Groups connected to it.
* **What to collect:** Under the ALB's **Listeners** tab, look at Port 443 (HTTPS). Note the **Rules** (e.g., "If path is `/api/*`, forward to `backend-tg`"). 
* **Why it matters:** We will likely use this *exact same Load Balancer* for the frontend. We will just add a new rule: "If path is `/*`, forward to `frontend-tg`".

### 4. Security Groups (The Firewalls)
* **Where to click:** Search for **EC2** -> **Security Groups**.
* **What you should see:** Groups like `alb-sg`, `backend-ecs-sg`, `db-sg`.
* **What to collect:** Look at the `Inbound Rules` for the `backend-ecs-sg`. You'll see it only accepts traffic from the `alb-sg`.
* **Why it matters:** We need to replicate this exact security model for the frontend container.

### 5. ECR & Route53 (Storage & DNS)
* **Where to click:** Search **ECR** for Docker images, and **Route53** -> **Hosted Zones** for DNS.
* **What to collect:** The ECR repository URL format, and the domain name (e.g., `dev-siteops-platform.transvolt.org`).

> [!IMPORTANT]
> **Discovery Checklist for your Team:**
> - [ ] VPC ID and Subnet IDs (Public vs Private) identified.
> - [ ] Existing ECS Cluster name noted.
> - [ ] ARN of the existing Application Load Balancer.
> - [ ] IDs of the ALB Security Group.
> - [ ] IAM Role ARN used by the backend tasks (`ecsTaskExecutionRole`).

---

## 🔍 Phase 2: Understand Current Backend Deployment

Let's reverse-engineer how your backend is currently running in DEV.

### The Flow of Traffic & Deployment
1. **Docker Push:** A developer runs `docker push` sending the backend image to **ECR**.
2. **Task Definition Update:** A new **Task Definition** revision is created pointing to this new ECR image tag. It defines the CPU, Memory, and Environment Variables.
3. **Service Deployment:** The **ECS Service** is told to use the new Task Definition. It spins up the new container.
4. **Target Group Registration:** Once the new container is up, ECS registers its internal IP address with the **Target Group**.
5. **Load Balancer Routing:** The **ALB** receives internet traffic via **Route53** (DNS), checks the Target Group, and forwards the request to the backend container.

### How Secrets and Logs Work
* **Secrets Management:** Look at the backend Task Definition in the AWS Console. Under Environment Variables, you'll see `ValueFrom` pointing to an ARN in **AWS Systems Manager Parameter Store** or **Secrets Manager**. This is how secrets (like DB passwords) are injected securely without hardcoding them.
* **Logs:** The Task Definition has a section called `Log Configuration` pointing to `awslogs`. This automatically streams standard output to **CloudWatch Logs** under a specific Log Group.

---

## 🧪 Phase 3: Frontend Readiness Validation

Before we deploy the frontend, we must validate it is production-ready. Frontend Docker apps behave very differently from backend apps.

### The Concept
Your `fleet-insights-pro` app is built with Vite. When you run `vite build`, it compiles React into static `.html`, `.js`, and `.css` files. 
Therefore, your Dockerfile has two stages:
1. A Node.js environment to build the static files.
2. An Nginx server to serve those static files to the internet.

### Production Readiness Checklist
- [ ] **Environment Variables:** Are `VITE_API_BASE_URL` variables injected *during the Docker build phase*? (Browsers cannot read ECS environment variables at runtime).
- [ ] **Dockerfile Quality:** Are you using multi-stage builds (Builder -> Nginx)?
- [ ] **Port Configuration:** Is Nginx configured to listen on Port 80? Does it expose port 80?
- [ ] **Health Check:** Does Nginx return a 200 OK when you request `/`? (The ALB needs this).
- [ ] **Routing:** Does your Nginx config route all 404s back to `index.html`? (Crucial for React Router/TanStack Router to handle client-side routing).

---

## 🚢 Phase 4: ECS Frontend Deployment

Now that we understand the architecture, here is exactly WHY and HOW we deploy the frontend.

1. **Create ECR Repository:**
   * *Why:* We need a secure, AWS-hosted locker for our frontend image.
2. **Build and Push to ECR:**
   * *Why:* ECS Fargate needs to pull the image from a trusted AWS source.
3. **Create a Target Group (`frontend-tg`):**
   * *Why:* The Load Balancer needs a logical "bucket" to dump web traffic into. We set the health check to `/`.
4. **Update Application Load Balancer Rules:**
   * *Why:* We add a rule to the *existing* ALB: "If the URL path is `/*` (anything), forward to `frontend-tg`." (Ensure the backend rule `/api/*` has higher priority!).
5. **Create Task Definition (`frontend-task`):**
   * *Why:* We tell ECS to use our ECR image, give it 0.25 vCPU and 0.5 GB RAM (frontends need very little compute), map Port 80, and send logs to CloudWatch.
6. **Create ECS Service (`frontend-service`):**
   * *Why:* We attach the Task Definition to the Cluster. We tell it: "Always keep 1 container running. Attach it to `frontend-tg`. Put it in the Private Subnets. Use the backend's Security Group logic."

**Auto Scaling (Why?):** We configure Target Tracking Auto Scaling. If CPU utilization hits 70%, ECS automatically spins up a 2nd container to handle the load, and registers it with the Target Group.

---

## 🌟 Phase 5: Industry Best Practices

As an architect, deployment is only 20% of the job. Operating it securely and reliably is 80%.

### 1. Deployment Strategies
* **Rolling Deployment (Standard):** ECS spins up the new container, waits for it to pass ALB health checks, shifts traffic to it, and then kills the old container. **Zero Downtime.**
* **Blue/Green Deployment:** You spin up an entirely duplicate "Green" environment. You test it internally. Once verified, you flip the DNS or Load Balancer switch instantly. Safest, but costs more.

### 2. Rollback Strategy
If a deployment fails (e.g., white screen of death on the frontend), ECS allows you to go to the Service, click "Update", and select the *previous* Revision of the Task Definition. Within 60 seconds, the old, working version is back online.

### 3. Monitoring & Alerting
* Create **CloudWatch Alarms** for ALB HTTP 5xx errors. If your target group starts failing health checks, your team should get an email/Slack notification immediately via SNS (Simple Notification Service).

### 4. Cost Optimization
* Use **Fargate Spot** for DEV environments. It uses spare AWS capacity and costs up to 70% less than standard Fargate.
* Frontends serve static assets. In a real production environment at scale, you wouldn't put the frontend in ECS at all! You would put the static files in an **S3 Bucket** and serve them via **CloudFront** (CDN) for microscopic costs and global edge-caching. (But for now, ECS Nginx is perfectly fine and standard for containerized enterprise setups).

### 5. Security
* Containers should be in **Private Subnets** with no public IP. They should only be accessible through the ALB (which lives in the Public Subnets).
* Nginx should not run as the `root` user inside the container.

---

Read through these phases. Absorb the architecture. When you are ready, your first assignment as an architect is to log into the AWS Console and complete the **Phase 1 Discovery Checklist**. Let me know what you find!
