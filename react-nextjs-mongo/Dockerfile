FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3003

# Use NODE_ENV to decide: production builds and starts, dev runs hot-reload
# Default to dev for local Docker Compose usage
ENV NODE_ENV=development

# Build for production when NODE_ENV=production, otherwise run dev server
CMD if [ "$NODE_ENV" = "production" ]; then \
      npm run build && npm run start; \
    else \
      npm run dev; \
    fi
