const Company = require('../models/Company');

const getBudget = async (req, res) => {
  try {
    const company = await Company.findOne();
    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });

    const departments = company.departments.map((d) => ({
      id: d._id,
      name: d.name,
      monthlyBudget: d.monthlyBudget,
      spent: d.spent,
      remaining: d.monthlyBudget - d.spent,
      utilizationPct: d.monthlyBudget > 0 ? Math.round((d.spent / d.monthlyBudget) * 100) : 0,
    }));

    res.json({ success: true, data: departments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const upsertDepartment = async (req, res) => {
  try {
    const { name, monthlyBudget } = req.body;
    if (!name || monthlyBudget === undefined) {
      return res.status(400).json({ success: false, message: 'name and monthlyBudget are required' });
    }

    const company = await Company.findOne();
    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });

    const existing = company.departments.find(
      (d) => d.name.toLowerCase() === name.toLowerCase()
    );

    if (existing) {
      existing.monthlyBudget = monthlyBudget;
    } else {
      company.departments.push({ name, monthlyBudget, spent: 0 });
    }

    await company.save();
    res.json({ success: true, data: company.departments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteDepartment = async (req, res) => {
  try {
    const company = await Company.findOne();
    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });

    company.departments = company.departments.filter(
      (d) => d.name.toLowerCase() !== req.params.name.toLowerCase()
    );

    await company.save();
    res.json({ success: true, data: company.departments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getCompany = async (req, res) => {
  try {
    const company = await Company.findOne();
    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });
    res.json({ success: true, data: company });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getBudget, upsertDepartment, deleteDepartment, getCompany };