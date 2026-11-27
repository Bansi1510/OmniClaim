import { useState } from 'react';
import { Form, Checkbox, Button } from 'semantic-ui-react';

const defaultView = { name: '', components: [], minImages: 1 };

const ImageRequirementConfigurator = ({ config, onChange }) => {
  const [views, setViews] = useState(config?.views || [defaultView]);

  const updateConfig = (newViews) => {
    onChange({ ...config, views: newViews });
  };

  return (
    <div className="image-requirements">
      <h3>Asset Image Requirements</h3>
      {views.map((view, index) => (
        <ViewConfigPanel
          key={index}
          view={view}
          onChange={(updatedView) => {
            const newViews = [...views];
            newViews[index] = updatedView;
            setViews(newViews);
            updateConfig(newViews);
          }}
          onRemove={() => {
            const newViews = views.filter((_, i) => i !== index);
            setViews(newViews);
            updateConfig(newViews);
          }}
        />
      ))}
      <Button
        icon='add'
        content='Add View'
        onClick={() => {
          const newViews = [...views, defaultView];
          setViews(newViews);
          updateConfig(newViews);
        }}
      />
    </div>
  );
};

const ViewConfigPanel = ({ view, onChange, onRemove }) => {
  const [localView, setLocalView] = useState(view);

  const handleChange = (field, value) => {
    const updatedView = { ...localView, [field]: value };
    setLocalView(updatedView);
    onChange(updatedView);
  };

  return (
    <div className="view-config">
      <input
        placeholder="View Name (e.g., Front View)"
        value={localView.name}
        onChange={(e) => handleChange('name', e.target.value)}
      />
      <ComponentSelector
        selected={localView.components}
        onChange={(components) => handleChange('components', components)}
      />
      <input
        type="number"
        placeholder="Min Images"
        value={localView.minImages}
        onChange={(e) => handleChange('minImages', parseInt(e.target.value) || 0)}
        min={1}
      />
      <Button negative onClick={onRemove}>Remove View</Button>
    </div>
  );
};

// Integrate into main form
const PolicyProductForm = ({ product }) => {
  const [formData, setFormData] = useState({
    ...product,
    isAssetImageRequired: product.isAssetImageRequired ?? false,
    imageRequirementConfig: product.imageRequirementConfig ?? {},
  });

  const handleSubmit = async () => {
    await api.updatePolicyProduct(product.id, formData);
  };

  return (
    <Form onSubmit={handleSubmit}>
      {/* Standard product fields */}
      <Form.Field>
        <label>Require Asset Images</label>
        <Checkbox
          checked={formData.isAssetImageRequired}
          onChange={(e, { checked }) => {
            setFormData(prev => ({ ...prev, isAssetImageRequired: checked }));
          }}
        />
      </Form.Field>

      {formData.isAssetImageRequired && (
        <ImageRequirementConfigurator
          config={formData.imageRequirementConfig}
          onChange={(config) => {
            setFormData(prev => ({ ...prev, imageRequirementConfig: config }));
          }}
        />
      )}

      <Button type="submit">Save Product</Button>
    </Form>
  );
};

export default PolicyProductForm;