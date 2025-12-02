
/**
    * Checks if a given environment variable key corresponds to a URI-based dependency.
    * @param {string} key - The environment variable key to check.
    * @returns {boolean} - True if the key is URI-based, false otherwise.
    * @example
 */
const isUriBasedDependency = (key) => {
  if (typeof key !== 'string') return false;  
  const uriBasedPrefixes = ['ENDPOINT_MODULE_', 'URI_', 'VITE_URI_', 'MQTT_URI']
  return uriBasedPrefixes.some(prefix => key.startsWith(prefix))
} 


export { isUriBasedDependency };