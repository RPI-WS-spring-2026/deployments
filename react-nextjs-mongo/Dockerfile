FROM node:18

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Build the Next.js production bundle at image build time
RUN npm run build

EXPOSE 3003

# Default to production start. For local dev, docker-compose overrides this
# with `npm run dev` via the command directive.
CMD ["npm", "run", "start"]
