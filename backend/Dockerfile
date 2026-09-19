# Use Node.js 18 (meeting the >=18.17.0 requirement from package.json)
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies (npm install should not need environment variables)
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the port (default 3000 from config)
EXPOSE 3000

# Start the application
CMD ["npm", "run", "start"]
