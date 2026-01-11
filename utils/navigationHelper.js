/**
 * Navigation Helper - Centralized navigation configuration
 * Created: January 10, 2026
 * Purpose: Smooth and easy navigation between pages
 */

const navItems = [
  {
    label: 'Home',
    path: '/',
    icon: 'home',
    order: 1,
    description: 'Go to home page'
  },
  {
    label: 'Properties',
    path: '/properties',
    icon: 'building',
    order: 2,
    description: 'View all properties'
  },
  {
    label: 'Categories',
    path: '/#category',
    icon: 'tags',
    order: 3,
    description: 'Browse property categories'
  },
  {
    label: 'Services',
    path: '/#services',
    icon: 'headset',
    order: 4,
    description: 'Our services'
  },
  {
    label: 'About',
    path: '/#about',
    icon: 'info',
    order: 5,
    description: 'About us'
  },
  {
    label: 'Contact',
    path: '/#contact',
    icon: 'mail',
    order: 6,
    description: 'Contact information'
  }
];

// Sort by order
navItems.sort((a, b) => a.order - b.order);

module.exports = navItems;