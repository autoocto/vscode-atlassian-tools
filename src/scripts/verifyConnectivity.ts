/**
 * Verify connectivity to Atlassian services (Jira and Confluence)
 * 
 * Usage: 
 *   npx ts-node src/scripts/verifyConnectivity.ts [service]
 * 
 * Parameters:
 *   service - Optional. Specify which service to verify. Options:
 *             all (default), jira, confluence
 * 
 * Examples:
 *   npx ts-node src/scripts/verifyConnectivity.ts          # Verify all services
 *   npx ts-node src/scripts/verifyConnectivity.ts all      # Verify all services
 *   npx ts-node src/scripts/verifyConnectivity.ts jira     # Verify only JIRA
 *   npx ts-node src/scripts/verifyConnectivity.ts confluence # Verify only Confluence
 */

import * as dotenv from 'dotenv';
import { loadAtlassianConfig, AtlassianConfig } from '../utils/configLoader';
import { JiraHelper } from '../helpers/jiraHelper';
import { ConfluenceHelper } from '../helpers/confluenceHelper';

// Load environment variables from .env file
dotenv.config();

/**
 * Verify JIRA connectivity
 */
async function verifyJira(config: AtlassianConfig): Promise<void> {
    if (config && config.baseUrl) {
        console.log('\n🔌 Testing JIRA connection...');
        const jira = new JiraHelper(config);

        try {
            const jiraConnected = await jira.checkConnection();
            if (jiraConnected) {
                console.log(`✅ Connected to JIRA: ${config.baseUrl}`);
                const user = await jira.getCurrentUser();
                console.log(`👤 Logged in as: ${user.displayName} (${user.emailAddress})`);
            } else {
                console.log(`❌ Failed to connect to JIRA: ${config.baseUrl}`);
            }
        } catch (error) {
            console.error(`❌ JIRA connection error: ${error}`);
        }
    } else {
        console.log('\n⚠️  JIRA configuration not found');
    }
}

/**
 * Verify Confluence connectivity
 */
async function verifyConfluence(config: AtlassianConfig): Promise<void> {
    if (config && config.baseUrl) {
        console.log('\n🔌 Testing Confluence connection...');
        const confluence = new ConfluenceHelper(config);

        try {
            const confluenceConnected = await confluence.checkConnection();
            if (confluenceConnected) {
                console.log(`✅ Connected to Confluence: ${config.baseUrl}`);
                const user = await confluence.getCurrentUser();
                console.log(`👤 Logged in as: ${user.displayName} (${user.email})`);
            } else {
                console.log(`❌ Failed to connect to Confluence: ${config.baseUrl}`);
            }
        } catch (error) {
            console.error(`❌ Confluence connection error: ${error}`);
        }
    } else {
        console.log('\n⚠️  Confluence configuration not found');
    }
}

async function main() {
    // Parse command-line arguments
    const args = process.argv.slice(2);
    const requestedService = args[0]?.toLowerCase() || 'all';

    // Available services
    const availableServices = ['all', 'jira', 'confluence'];

    // Map service names to their verification functions
    const serviceFunctions: Record<string, (config: AtlassianConfig) => Promise<void>> = {
        'jira': verifyJira,
        'confluence': verifyConfluence
    };

    // Validate requested service
    if (!availableServices.includes(requestedService)) {
        console.error(`❌ Invalid service: '${requestedService}'`);
        console.log(`\nAvailable services: ${availableServices.join(', ')}`);
        console.log('\nUsage: npx ts-node src/scripts/verifyConnectivity.ts [service]');
        process.exit(1);
    }

    console.log('🔍 Verifying Atlassian connectivity...\n');

    // Load configuration
    let config: AtlassianConfig;
    try {
        const loadedConfig = loadAtlassianConfig();
        if (!loadedConfig) {
            console.error('❌ Configuration error: Failed to load configuration');
            process.exit(1);
        }
        config = loadedConfig;
        console.log('✅ Configuration loaded successfully\n');
    } catch (error: any) {
        console.error('❌ Configuration error:', error.message);
        process.exit(1);
    }

    // Test connectivity for requested service(s)
    if (requestedService === 'all') {
        console.log('🌐 Verifying all services...\n');
        await verifyJira(config);
        await verifyConfluence(config);
    } else {
        console.log(`🌐 Verifying ${requestedService.toUpperCase()} only...\n`);
        await serviceFunctions[requestedService](config);
    }

    console.log('\n✅ Verification complete!');
}

main().catch(error => {
    console.error('Error:', error);
    process.exit(1);
});
