FROM node:18-slim

RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

RUN ln -sf /opt/venv/bin/python /usr/bin/python

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY requirements.txt ./
COPY ml/requirements.txt ./ml/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
