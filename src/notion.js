const { Client } = require('@notionhq/client');
const { NotionToMarkdown } = require('notion-to-md');
require('dotenv').config();

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

const n2m = new NotionToMarkdown({ notionClient: notion });

class NotionService {
  async getNextPostToPublish() {
    try {
      const response = await notion.databases.query({
        database_id: process.env.NOTION_DATABASE_ID,
        filter: {
          property: 'Status wp',
          select: {
            equals: 'pronto'
          }
        },
        sorts: [
          {
            property: 'data de publicacao',
            direction: 'ascending'
          }
        ]
      });

      if (response.results.length === 0) {
        console.log('Nenhum post encontrado para publicar');
        return null;
      }

      const page = response.results[0];
      const content = await this.getPageContent(page.id);
      
      return {
        id: page.id,
        title: page.properties['Título do Esboço']?.title[0]?.plain_text || 'Sem título',
        content: content,
        category: page.properties.categoria?.select?.name || 'Geral',
        featuredImageKeyword: page.properties.pcid?.rich_text[0]?.plain_text || '',
        contentImageKeyword: page.properties.pcic?.rich_text[0]?.plain_text || ''
      };
    } catch (error) {
      console.error('Erro ao buscar posts do Notion:', error);
      throw error;
    }
  }

  async getPageContent(pageId) {
    try {
      const mdblocks = await n2m.pageToMarkdown(pageId);
      const mdString = n2m.toMarkdownString(mdblocks);
      return mdString.parent;
    } catch (error) {
      console.error('Erro ao converter página para markdown:', error);
      throw error;
    }
  }

  async markAsPublished(pageId) {
    try {
      await notion.pages.update({
        page_id: pageId,
        properties: {
          'Status wp': {
            select: {
              name: 'publicado'
            }
          },
          'data de publicacao real': {
            date: {
              start: new Date().toISOString()
            }
          }
        }
      });
      console.log('Post marcado como publicado no Notion');
    } catch (error) {
      console.error('Erro ao atualizar status no Notion:', error);
      throw error;
    }
  }
}

module.exports = NotionService;
