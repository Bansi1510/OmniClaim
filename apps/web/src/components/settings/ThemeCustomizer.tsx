import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Grid, Divider, Header, Message } from 'semantic-ui-react';
import axios from 'axios';

const ThemeCustomizer = () => {
  const [config, setConfig] = useState({
    primaryColor: '#3b82f6',
    secondaryColor: '#10b981',
    accentColor: '#f59e0b',
    sidebarColor: '#1e293b',
    borderRadius: '6px',
    darkMode: false,
    fontFamily: 'Inter, sans-serif',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchTheme();
  }, []);

  const fetchTheme = async () => {
    try {
      const { data } = await axios.get('/api/v1/theme/preference');
      setConfig(data.themeConfig);
    } catch (err) {
      console.error('Failed to fetch theme', err);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await axios.put('/api/v1/theme/preference', { themeConfig: config });
      setMessage('Theme updated successfully. Applying changes...');
      // In a real app, this would trigger a global theme update context or CSS variable injection
      applyThemeToDom(config);
    } catch (err) {
      setMessage('Error updating theme');
    } finally {
      setLoading(false);
    }
  };

  const applyThemeToDom = (newConfig) => {
    Object.keys(newConfig).forEach(key => {
      document.documentElement.style.setProperty(`--theme-${key}`, newConfig[key]);
    });
  };

  const handleChange = (e, { name, value }) => {
    setConfig(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="theme-customizer">
      <Header as="h2">Theme & Appearance</Header>
      <Grid>
        <Grid.Column width={8}>
          <Card fluid>
            <Card.Content>
              <Form>
                <Form.Group widths='equal'>
                  <Form.Field>
                    <label>Primary Color</label>
                    <input type="color" name="primaryColor" value={config.primaryColor} onChange={handleChange} />
                  </Form.Field>
                  <Form.Field>
                    <label>Sidebar Color</label>
                    <input type="color" name="sidebarColor" value={config.sidebarColor} onChange={handleChange} />
                  </Form.Field>
                </Form.Group>
                <Form.Field>
                  <label>Border Radius</label>
                  <Input name="borderRadius" value={config.borderRadius} onChange={handleChange} />
                </Form.Field>
                <Button primary loading={loading} onClick={handleSave}>Save Theme</Button>
              </Form>
              {message && <Message info>{message}</Message>}
            </Card.Content>
          </Card>
        </Grid.Column>
        <Grid.Column width={8}>
          <Header as="h3">Live Preview</Header>
          <div style={{
            padding: '20px',
            borderRadius: config.borderRadius,
            backgroundColor: config.sidebarColor,
            color: 'white'
          }}>
            <h4 style={{ color: config.primaryColor }}>Preview Area</h4>
            <Button style={{ backgroundColor: config.primaryColor }}>Primary Action</Button>
          </div>
        </Grid.Column>
      </Grid>
    </div>
  );
};

export default ThemeCustomizer;
