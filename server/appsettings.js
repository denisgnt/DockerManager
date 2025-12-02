const DOCKER_API_HOST = process.env.VITE_DOCKER_API_HOST || 'localhost'
const DOCKER_API_PORT = process.env.VITE_DOCKER_API_PORT || '2375'

export const DOCKER_HOST = `http://${DOCKER_API_HOST}:${DOCKER_API_PORT}`
export const PORT = process.env.VITE_BACKEND_PORT || 5005
export const SCRIPTS_DIR = process.env.SCRIPTS_DIR || '/home/axitech/BPM2'