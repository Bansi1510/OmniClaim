import React, { useState, useEffect } from 'react';
import { Sidebar, Menu, Icon, Header } from 'semantic-ui-react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';

const DynamicSidebar = () => {
  const [menuItems, setMenuItems] = useState([]);
  const [activeItem, setActiveItem] = useState('');
  const location = useLocation();

  useEffect(() => {
    fetchMenu();
  }, []);

  useEffect(() => {
    setActiveItem(location.pathname);
  }, [location]);

  const fetchMenu = async () => {
    try {
      const { data } = await axios.get('/api/v1/rbac/navigation-menu');
      setMenuItems(data);
    } catch (err) {
      console.error('Failed to fetch menu', err);
    }
    setActiveItem(location.pathname);
  };

  const renderMenuItems = (items) => {
    return items.map(item => {
      const isActive = activeItem === item.navLink || (item.children && item.children.some(child => child.navLink === activeItem));
      return (
        <Menu.Item
          key={item.id}
          active={isActive}
          as={Link}
          to={item.navLink || '#'}
        >
          {item.icon && <Icon name={item.icon} />}
          {item.title}
          {item.badgeName && (
            <span className="sidebar-badge" style={{ backgroundColor: item.badgeColor }}>
              {item.badgeName}
            </span>
          )}
          {item.children && (
            <Menu.Menu>{renderMenuItems(item.children)}</Menu.Menu>
          )}
        </Menu.Item>
      );
    });
  };

  return (
    <Sidebar
      as={Menu}
      animation="slide along"
      direction="left"
      visible={true}
      vertical
    >
      <Menu.Header>
        <Header as="h3">OmniClaim ERP</Header>
      </Menu.Header>
      <Menu.Item as={Link} to="/dashboard">
        <Icon name="home" />
        Dashboard
      </Menu.Item>
      {menuItems.length > 0 ? (
        menuItems.map(item => renderMenuItems([item]))
      ) : (
        <Menu.Item disabled>
          Loading Navigation...
        </Menu.Item>
      )}
      <Menu.Divider />
      <Menu.Header>
        <Header as="h4">Settings</Header>
      </Menu.Header>
      <Menu.Item as={Link} to="/admin/permissions">
        <Icon name="shield" />
        Permission Master
      </Menu.Item>
      <Menu.Item as={Link} to="/admin/theme">
        <Icon name="paint brush" />
        Theme & Appearance
      </Menu.Item>
    </Sidebar>
  );
};

export default DynamicSidebar;
