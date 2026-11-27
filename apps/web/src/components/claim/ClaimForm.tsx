import { useState, useEffect } from 'react';
import { usePolicy } from '../../context/PolicyContext';
import { uploadImage } from '../../services/api';

type ClaimFormProps = {
  onSubmit: (data: any) => void;
};

const ClaimForm: React.FC<ClaimFormProps> = ({ onSubmit }) => {
  const [formData, setFormData] = useState({} as any);
  const [baselineImages, setBaselineImages] = useState<File[]>([]);
  const { policy } = usePolicy();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setBaselineImages(Array.from(e.target.files));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const imageUrls = await Promise.all(
      baselineImages.map(file => uploadImage(file))
    );
    const data = {
      ...formData,
      assetCategory: policy.assetCategory,
      baselineImages: imageUrls
    };
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Existing claim fields */}
      <div>
        <label>Incident Description</label>
        <input type="text" name="description" onChange={handleChange} />
      </div>
      {/* Conditional baseline images upload */}
      {policy.isAssetImageRequired && (
        <div>
          <label>Baseline Images (for AI Verification)</label>
          <input
            type="file" multiple
            accept="image/*"
            onChange={handleImageChange}
          />
        </div>
      )}
      <button type="submit">Submit Claim</button>
    </form>
  );
};

export default ClaimForm;