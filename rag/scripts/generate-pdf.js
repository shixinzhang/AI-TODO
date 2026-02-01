const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const outputPath = path.join(__dirname, '../demo-data/complex_sample.pdf');
const doc = new PDFDocument({ size: 'A4', margin: 50 });

doc.pipe(fs.createWriteStream(outputPath));

// 1. 标题
doc.fontSize(25).text('2024 年度财务与运营综合报告', { align: 'center' });
doc.moveDown();

// 2. 多栏布局 (模拟)
doc.fontSize(12).text('以下是本年度各部门的关键绩效指标与财务摘要。本报告旨在提供透明、准确的数据支持。', { align: 'justify' });
doc.moveDown();

const lorem = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.";

// 绘制两栏文本
const colWidth = 230;
const gap = 30;
const startY = doc.y;

// 左栏
doc.text(lorem + "\n\n" + lorem, 50, startY, { width: colWidth, align: 'justify' });

// 右栏
doc.text(lorem + "\n\n" + lorem, 50 + colWidth + gap, startY, { width: colWidth, align: 'justify' });

// 3. 模拟表格
doc.moveDown(8);
doc.fontSize(16).text('Q4 财务数据摘要 (Table 1)', 50, doc.y, { underline: true });
doc.moveDown();

const tableTop = doc.y;
const itemX = 50;
const q1X = 250;
const q2X = 350;
const q3X = 450;

// 表头
doc.fontSize(12).font('Helvetica-Bold');
doc.text('Item', itemX, tableTop);
doc.text('Revenue ($)', q1X, tableTop);
doc.text('Cost ($)', q2X, tableTop);
doc.text('Profit ($)', q3X, tableTop);

// 分割线
doc.moveTo(itemX, tableTop + 15).lineTo(550, tableTop + 15).stroke();

// 数据行
doc.font('Helvetica');
const rows = [
    ['Product A', '120,000', '80,000', '40,000'],
    ['Product B', '95,000', '60,000', '35,000'],
    ['Service C', '200,000', '50,000', '150,000'],
    ['Total', '415,000', '190,000', '225,000']
];

let rowY = tableTop + 25;
rows.forEach(row => {
    doc.text(row[0], itemX, rowY);
    doc.text(row[1], q1X, rowY);
    doc.text(row[2], q2X, rowY);
    doc.text(row[3], q3X, rowY);
    rowY += 20;
});

// 4. 混合排版
doc.moveDown(2);
doc.fontSize(14).text('风险评估与合规性', { underline: true });
doc.fontSize(10).text('Compliance is key to our operation. We adhere to ISO 27001 standards.', { oblique: true });

doc.end();
console.log(`PDF created at: ${outputPath}`);
