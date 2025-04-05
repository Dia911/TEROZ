#!/usr/bin/env node
const chalk = require('chalk');
const { URL } = require('url');
const semver = require('semver');

// Cấu hình các hằng số
const REQUIRED_CONTACT_FIELDS = ['phone', 'facebook', 'zalo'];
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const URL_REGEX = /https?:\/\/[^\s]+/g;

// Load dữ liệu FAQ
let faqData;
try {
  faqData = require('./faq.js');
} catch (error) {
  console.error(chalk.bold.red('❌ Lỗi: Không thể tải file faq.js'));
  console.error(chalk.red(`Chi tiết: ${error.message}`));
  process.exit(1);
}

// Lớp Validator
class FAQValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.ids = new Set();
  }

  run() {
    console.log(chalk.bold.cyan('\n🛠️ Bắt đầu kiểm tra toàn diện dữ liệu FAQ\n'));
    
    this.checkStructure()
      .checkCategories()
      .checkMetadata()
      .checkQuestions()
      .reportResults();
  }

  checkStructure() {
    if (!faqData || typeof faqData !== 'object') {
      this.errors.push('Cấu trúc dữ liệu gốc không hợp lệ');
    }
    return this;
  }

  checkCategories() {
    if (!Array.isArray(faqData.categories)) {
      this.errors.push('Mục categories phải là một mảng');
      return this;
    }

    if (faqData.categories.length === 0) {
      this.warnings.push('Không có danh mục nào được định nghĩa');
    }

    faqData.categories.forEach((category, index) => {
      const prefix = `Danh mục ${index + 1}`;
      
      // Kiểm tra ID
      if (!category.id) {
        this.errors.push(`${prefix}: Thiếu ID`);
      } else if (this.ids.has(category.id)) {
        this.errors.push(`ID trùng lặp: ${category.id}`);
      } else {
        this.ids.add(category.id);
      }

      // Kiểm tra tiêu đề
      if (!category.title) {
        this.errors.push(`${prefix}: Thiếu tiêu đề`);
      }
      
      // Kiểm tra câu hỏi
      if (!category.questions || !Array.isArray(category.questions)) {
        this.errors.push(`${prefix}: Thiếu mục questions hoặc không phải mảng`);
      }
    });
    
    return this;
  }

  checkQuestions() {
    faqData.categories?.forEach(category => {
      category.questions?.forEach((question, index) => {
        const prefix = `Câu hỏi ${index + 1} (${category.id})`;
        
        // Kiểm tra ID
        if (!question.id) {
          this.errors.push(`${prefix}: Thiếu ID`);
        } else if (this.ids.has(question.id)) {
          this.errors.push(`ID trùng lặp: ${question.id}`);
        } else {
          this.ids.add(question.id);
        }

        // Kiểm tra nội dung
        if (!question.question) {
          this.errors.push(`${prefix}: Thiếu nội dung câu hỏi`);
        }
        
        // Kiểm tra câu trả lời
        if (!question.answer) {
          this.warnings.push(`${prefix}: Thiếu câu trả lời`);
        } else {
          this.validateUrls(question.answer, question.id);
        }
      });
    });
    return this;
  }

  checkMetadata() {
    const meta = faqData.metadata;
    if (!meta) {
      this.errors.push('Thiếu toàn bộ mục metadata');
      return this;
    }

    // Kiểm tra phiên bản
    if (typeof meta.version !== 'string' || !semver.valid(meta.version)) {
      this.errors.push(`Phiên bản không hợp lệ: ${meta.version}`);
    }

    // Kiểm tra ngày
    if (!DATE_REGEX.test(meta.lastUpdated)) {
      this.errors.push(`Định dạng ngày không hợp lệ: ${meta.lastUpdated}`);
    }

    // Kiểm tra thông tin liên hệ
    if (!meta.contact) {
      this.errors.push('Thiếu mục contact trong metadata');
    } else {
      REQUIRED_CONTACT_FIELDS.forEach(field => {
        if (!meta.contact[field]) {
          this.warnings.push(`Thiếu thông tin liên hệ: ${field}`);
        }
      });
    }
    
    return this;
  }

  validateUrls(text, questionId) {
    const urls = text.match(URL_REGEX) || [];
    urls.forEach(url => {
      try {
        new URL(url);
      } catch {
        this.errors.push(`URL không hợp lệ trong câu hỏi ${questionId}: ${url}`);
      }
    });
  }

  reportResults() {
    console.log(chalk.bold('\n🔍 Tổng hợp kết quả kiểm tra:'));
    
    // Hiển thị lỗi
    if (this.errors.length > 0) {
      console.log(chalk.bold.red(`\n❌ Tìm thấy ${this.errors.length} lỗi nghiêm trọng:`));
      this.errors.forEach(e => console.log(chalk.red(`- ${e}`)));
    } else {
      console.log(chalk.bold.green('\n✅ Không có lỗi nghiêm trọng'));
    }

    // Hiển thị cảnh báo
    if (this.warnings.length > 0) {
      console.log(chalk.bold.yellow(`\n⚠️ Có ${this.warnings.length} cảnh báo:`));
      this.warnings.forEach(w => console.log(chalk.yellow(`- ${w}`)));
    }

    // Thống kê
    console.log(chalk.bold.cyan('\n📊 Thống kê:'));
    console.log(`- Tổng danh mục: ${chalk.bold(faqData.categories?.length || 0)}`);
    console.log(`- Tổng câu hỏi: ${chalk.bold(this.getTotalQuestions())}`);
    console.log(chalk.bold.cyan('\n🎉 Kết thúc quá trình kiểm tra!\n'));
    
    process.exit(this.errors.length > 0 ? 1 : 0);
  }

  getTotalQuestions() {
    return faqData.categories?.reduce((acc, curr) => 
      acc + (curr.questions?.length || 0), 0) || 0;
  }
}

// Chạy validator
new FAQValidator().run();