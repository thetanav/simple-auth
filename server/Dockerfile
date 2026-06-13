FROM oven/bun

WORKDIR /app

COPY package*.json bun.lock* ./

RUN bun install

COPY . .

RUN bun run build

CMD ["bun", "start"]
