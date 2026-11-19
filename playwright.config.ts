import {defineConfig,devices} from '@playwright/test';
export default defineConfig({testDir:'./e2e',timeout:30000,expect:{timeout:5000},use:{baseURL:'http://127.0.0.1:5173',trace:'retain-on-failure'},projects:[{name:'chromium',use:{...devices['Desktop Chrome']}}],webServer:[
 {command:'npm run dev --workspace=server',url:'http://127.0.0.1:3000/health',reuseExistingServer:!process.env.CI,timeout:30000},
 {command:'npm run dev --workspace=client -- --host 127.0.0.1',url:'http://127.0.0.1:5173',reuseExistingServer:!process.env.CI,timeout:30000}
 ]});
