import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, Card, Header, Message } from 'semantic-ui-react';
import axios from 'axios';

const PermissionMaster = () => {
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPermission, setSelectedPermission] = useState(null);
  const [formData, setFormData] = useState({
    slug: '',
    module: 'CLAIMS',
    displayName: '',
    description: '',
  });
  const [message, setMessage] = useState('');

  const modules = [
    { value: 'CLAIMS', label: 'Claims Management' },
    { value: 'LEDGER', label: 'Financial Ledger' },
    { value: 'FRAUD', label: 'Fraud & SIU' },
    { value: 'RBAC', label: 'RBAC Management' },
    { value: 'AUDIT', label: 'Audit Trail' },
    { value: 'STP', label: 'STP Processing' },
  ];

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    try {
      const { data } = await axios.get('/api/v1/rbac/permissions/master');
      setPermissions(data);
    } catch (err) {
      console.error('Failed to fetch permissions', err);
      setMessage('Error loading permissions');
    }
    setLoading(false);
  };

  const handleCreate = async () => {
    setLoading(true);
    try {
      const { data } = await axios.post('/api/v1/rbac/permissions', formData);
      setPermissions(prev => [...prev, data]);
      setMessage('Permission created successfully');
      resetForm();
    } catch (err) {
      setMessage('Error creating permission');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async () => {
    setLoading(true);
    try {
      const { data } = await axios.put(`/api/v1/rbac/permissions/${selectedPermission.id}`, formData);
      setPermissions(prev => prev.map(p => p.id === data.id ? data : p));
      setMessage('Permission updated successfully');
      closeModal();
    } catch (err) {
      setMessage('Error updating permission');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this permission?')) {
      try {
        await axios.delete(`/api/v1/rbac/permissions/${id}`);
        setPermissions(prev => prev.filter(p => p.id !== id));
        setMessage('Permission deleted successfully');
      } catch (err) {
        setMessage('Error deleting permission');
      }
    }
  };

  const openEditModal = (permission) => {
    setSelectedPermission(permission);
    setFormData({
      slug: permission.slug,
      module: permission.module,
      displayName: permission.displayName,
      description: permission.description,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedPermission(null);
    resetForm();
  };

  const resetForm = () => {
    setFormData({ slug: '', module: 'CLAIMS', displayName: '', description: '' });
  };

  const handleChange = (e, { name, value }) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="permission-master">
      <Header as="h2">Permission Master</Header>
      <Card fluid>
        <Card.Content>
          <Button primary onClick={() => setModalOpen(true)}>
            Create New Permission
          </Button>
          {message && <Message info>{message}</Message>}
          <Table celled striped selectable>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Slug</Table.HeaderCell>
                <Table.HeaderCell>Module</Table.HeaderCell>
                <Table.HeaderCell>Display Name</Table.HeaderCell>
                <Table.HeaderCell>Description</Table.HeaderCell>
                <Table.HeaderCell>Actions</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {permissions.map(permission => (
                <Table.Row key={permission.id}>
                  <Table.Cell>{permission.slug}</Table.Cell>
                  <Table.Cell>{permission.module}</Table.Cell>
                  <Table.Cell>{permission.displayName}</Table.Cell>
                  <Table.Cell>{permission.description}</Table.Cell>
                  <Table.Cell>
                    <Button icon="edit" onClick={() => openEditModal(permission)} />
                    <Button icon="trash" color="red" onClick={() => handleDelete(permission.id)} />
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </Card.Content>
      </Card>

      <Modal open={modalOpen} onClose={closeModal}>
        <Modal.Header>{selectedPermission ? 'Edit Permission' : 'Create Permission'}</Modal.Header>
        <Modal.Content>
          <Form>
            <Form.Field>
              <label>Permission Slug</label>
              <Input name="slug" value={formData.slug} onChange={handleChange} />
            </Form.Field>
            <Form.Field>
              <label>Module</label>
              <Select
                options={modules}
                value={formData.module}
                onChange={(e, { value }) => handleChange(e, { name: 'module', value })}
              />
            </Form.Field>
            <Form.Field>
              <label>Display Name</label>
              <Input name="displayName" value={formData.displayName} onChange={handleChange} />
            </Form.Field>
            <Form.Field>
              <label>Description</label>
              <Input name="description" value={formData.description} onChange={handleChange} />
            </Form.Field>
          </Form>
        </Modal.Content>
        <Modal.Actions>
          <Button onClick={closeModal}>Cancel</Button>
          <Button
            positive
            loading={loading}
            onClick={selectedPermission ? handleEdit : handleCreate}
          >
            {selectedPermission ? 'Update' : 'Create'}
          </Button>
        </Modal.Actions>
      </Modal>
    </div>
  );
};

export default PermissionMaster;
