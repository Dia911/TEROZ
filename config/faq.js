// config/faq.js
const faqData = {
  categories: [
    {
      id: "general",
      title: "🔍 Tìm hiểu về OpenLive",
      questions: [
        {
          id: "what-is-openlive",
          question: "OnpenLive là gì?",
          answer:
            "OpenLive Group là một tập đoàn công nghệ tiên phong, được thành lập vào đầu năm 2021, chuyên cung cấp các giải pháp hỗ trợ doanh nghiệp trong quá trình chuyển đổi số một cách dễ dàng và hiệu quả, giúp tăng doanh thu và giảm chi phí vận hành.\n\nTầm nhìn của OpenLive Group là trở thành tập đoàn đa ngành hàng đầu châu Á, cung cấp các giải pháp về Công nghệ, Thương mại và Dịch vụ cho doanh nghiệp."
        },
        {
          id: "business-license",
          question: "Giấy phép Đăng Ký Kinh Doanh của OpenLive tại Việt Nam?",
          answer: "OpenLive có đầy đủ giấy tờ pháp lý theo quy định Việt Nam.\n[Ảnh giấy phép sẽ được cập nhật tại đây]"
        },
        {
          id: "sub-companies",
          question: "OpenLive có những công ty thành viên nào?",
          answer: `Hệ sinh thái OpenLive gồm 5 công ty chính:
            
1. OLabs - Công nghệ, Blockchain, AI
   🔗 Website: https://olabs.net
2. OMedia - Giải pháp truyền thông
3. OProduct - Thiết kế & xây dựng thương hiệu
4. OpenLive - Phân phối nhạc chất lượng cao
5. OBranding - Nền tảng TMĐT số`
        }
      ]
    },
    {
      id: "products",
      title: "🚀 Sản phẩm & Dịch vụ",
      questions: [
        {
          id: "obranding",
          question: "Sản phẩm chiến lược của OpenLive?",
          answer: `OBranding - Nền tảng TMĐT số tiên phong:

✓ Ưu điểm:
- Tăng tiếp cận thị trường
- Hỗ trợ chuyển đổi số toàn diện
- Kết nối hệ sinh thái đối tác
- Phát hành thẻ thành viên ưu đãi`
        },
        {
          id: "partners",
          question: "Đối tác chiến lược?",
          answer: `Các đối tác chính:

• SOL International
  - Tối ưu chuỗi cung ứng
  - Hợp tác từ 2022

• Velicious Food
  - Phân phối thực phẩm cao cấp

Xem chi tiết: [vnexpress.net/...]`
        }
      ]
    },
    {
      id: "investment",
      title: "💰 Đầu tư & Cổ đông",
      questions: [
        {
          id: "become-shareholder",
          question: "Cách trở thành cổ đông?",
          answer: `3 bước sở hữu MBC:
1. Đăng ký tài khoản XT.com
2. Nạp USDT vào ví
3. Mua token MBC

🔗 Đăng ký: [bcc.monbase.com]`
        },
        {
          id: "investment-benefits",
          question: "Quyền lợi cổ đông?",
          answer: `1. Lợi nhuận từ Monbase Exchange (09/2025)
2. Lợi nhuận từ NFT Marketplace
3. Thưởng MBC khi mua thẻ cổ đông

🎯 Ưu đãi:
- Thẻ 1000 USD → 850 USD
- Thanh toán bằng MBC`
        },
        {
          id: "investment-notes",
          question: "Lưu ý quan trọng?",
          answer: `⚠️ Cần lưu ý:
• Tiền đầu tư không hoàn lại
• Nhận quyền lợi định kỳ hàng năm
• Tư cách cổ đông vĩnh viễn`
        }
      ]
    },
    {
      id: "contact",
      title: "📞 Liên hệ",
      questions: [
        {
          id: "contact-info",
          question: "Thông tin liên hệ",
          answer: `Liên hệ ngay:

• Hotline: 0913831686 (24/7)
• Facebook: [fb.com/...]
• Zalo OA: [zalo.me/knzata264]
• Đăng ký: [bcc.monbase.com]

⏰ Giờ làm việc: Thứ 2 - Thứ 7 (8:00 - 17:00)`
        }
      ]
    }
  ],
  metadata: {
    lastUpdated: "2024-06-20",
    version: "1.1.0",
    contact: {
      phone: "0913831686",
      facebook: "https://www.facebook.com/profile.php?id=61573597316758",
      zalo: "https://zalo.me/g/knzata264",
      register: "https://bcc.monbase.com/sign-up?ref=4b396e3c20b39ee0728ca6ed101e9498",
      workingHours: "Thứ 2 - Thứ 7 (8:00 - 17:00)"
    },
    promotion: {
      shareholderCard: {
        originalPrice: 1000,
        discountPrice: 850,
        currency: "USD",
        paymentMethod: "MBC",
        validUntil: "2024-12-31"
      }
    }
  }
};

export default faqData;
