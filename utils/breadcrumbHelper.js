/**
 * Breadcrumb Helper - For better navigation clarity
 * Created: January 10, 2026
 * Purpose: Show user navigation path and enable easy backward navigation
 */

const getBreadcrumbs = (currentPath) => {
  // Split path and remove empty parts
  const pathParts = currentPath.split('/').filter(Boolean);
  
  // Start with home
  const breadcrumbs = [{
    label: 'Home',
    path: '/',
    active: pathParts.length === 0
  }];
  
  // Build breadcrumb trail
  let currentPathStr = '';
  pathParts.forEach((part, index) => {
    currentPathStr += '/' + part;
    const isLast = index === pathParts.length - 1;
    
    // Convert to readable label
    const label = part
      .charAt(0).toUpperCase() + 
      part.slice(1).replace(/-/g, ' ');
    
    breadcrumbs.push({
      label: label,
      path: currentPathStr,
      active: isLast
    });
  });
  
  return breadcrumbs;
};

module.exports = getBreadcrumbs;