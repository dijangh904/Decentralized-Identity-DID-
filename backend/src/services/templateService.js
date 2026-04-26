const CredentialTemplate = require('../models/CredentialTemplate');
const { logger } = require('../middleware');

class TemplateService {
  async createTemplate(templateData) {
    try {
      const template = new CredentialTemplate(templateData);
      await template.save();
      logger.info(`Credential template created: ${template.name}`);
      return template;
    } catch (error) {
      logger.error('Error creating credential template:', error);
      throw error;
    }
  }

  async getTemplates(filters = {}) {
    try {
      const query = { active: true };
      if (filters.credentialType) query.credentialType = filters.credentialType;
      if (filters.issuerDid) query.issuerDid = filters.issuerDid;
      
      return await CredentialTemplate.find(query).sort({ name: 1 });
    } catch (error) {
      logger.error('Error fetching credential templates:', error);
      throw error;
    }
  }

  async getTemplateById(id) {
    try {
      const template = await CredentialTemplate.findById(id);
      if (!template) throw new Error('Template not found');
      return template;
    } catch (error) {
      logger.error('Error fetching template by ID:', error);
      throw error;
    }
  }

  async updateTemplate(id, updateData) {
    try {
      const template = await CredentialTemplate.findByIdAndUpdate(id, updateData, { new: true });
      if (!template) throw new Error('Template not found');
      logger.info(`Credential template updated: ${template.name}`);
      return template;
    } catch (error) {
      logger.error('Error updating credential template:', error);
      throw error;
    }
  }

  async deleteTemplate(id) {
    try {
      const template = await CredentialTemplate.findByIdAndUpdate(id, { active: false }, { new: true });
      if (!template) throw new Error('Template not found');
      logger.info(`Credential template deactivated: ${template.name}`);
      return template;
    } catch (error) {
      logger.error('Error deleting credential template:', error);
      throw error;
    }
  }

  /**
   * Initializes common templates if they don't exist
   */
  async seedCommonTemplates() {
    const commonTemplates = [
      {
        name: 'University Degree',
        description: 'Standard template for academic degrees',
        credentialType: 'UniversityDegreeCredential',
        requiredClaims: [
          { name: 'degree', type: 'string', description: 'Name of the degree' },
          { name: 'university', type: 'string', description: 'Issuing university' },
          { name: 'graduationYear', type: 'number', description: 'Year of graduation' }
        ]
      },
      {
        name: 'Employment Verification',
        description: 'Proof of employment with a specific company',
        credentialType: 'EmploymentCredential',
        requiredClaims: [
          { name: 'employer', type: 'string', description: 'Name of the employer' },
          { name: 'jobTitle', type: 'string', description: 'Position held' },
          { name: 'startDate', type: 'date', description: 'Employment start date' }
        ]
      },
      {
        name: 'Age Verification',
        description: 'Proof that the subject is over a certain age',
        credentialType: 'AgeVerificationCredential',
        requiredClaims: [
          { name: 'over18', type: 'boolean', description: 'Whether the subject is over 18' },
          { name: 'over21', type: 'boolean', description: 'Whether the subject is over 21' }
        ]
      }
    ];

    for (const template of commonTemplates) {
      const existing = await CredentialTemplate.findOne({ name: template.name });
      if (!existing) {
        await this.createTemplate(template);
      }
    }
  }
}

module.exports = new TemplateService();
