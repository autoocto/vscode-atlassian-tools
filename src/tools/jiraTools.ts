/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Jira Language Model Tools
 * 
 * Tools are organized into the following groups:
 * 1. Issue Operations (CRUD, transitions, assignments)
 * 2. Issue Context (links, comments, worklogs, attachments, watchers, votes)
 * 3. Project Operations (info, components, statuses)
 * 4. Version Management (CRUD, progress)
 * 5. Epic Management (CRUD, progress)
 * 6. Search & Metadata (search, users, metadata)
 */

import * as vscode from 'vscode';
import { JiraHelper } from '../helpers/jiraHelper';
import { handleToolError, createSuccessResult } from '../utils/errorHandler';
import { formatJiraIssue, formatJiraIssueSummary } from '../utils/formatters';

export function registerJiraTools(context: vscode.ExtensionContext, helper: JiraHelper | null): void {
    const tools: vscode.Disposable[] = [];

    // =========================================================================
    // GROUP 1: ISSUE OPERATIONS
    // =========================================================================

    // Get Jira Issue Tool
    tools.push(vscode.lm.registerTool('getJiraIssue', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ issueKey: string }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Jira is not configured'));
            }
            const { issueKey } = options.input;
            try {
                const issue = await helper.getIssue(issueKey);
                const formatted = formatJiraIssue(issue);
                return createSuccessResult({ issue, formatted });
            } catch (error) {
                return handleToolError(error, `Failed to get Jira issue ${issueKey}`);
            }
        }
    }));

    // Create Jira Issue Tool
    tools.push(vscode.lm.registerTool('createJiraIssue', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ projectKey: string; summary: string; issueType?: string; description?: string }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Jira is not configured'));
            }
            const { projectKey, summary, issueType = 'Task', description } = options.input;
            try {
                const issue = await helper.createIssue(projectKey, summary, issueType, description);
                const formatted = formatJiraIssue(issue);
                return createSuccessResult({ message: `Created issue ${issue.key}`, issue, formatted });
            } catch (error) {
                return handleToolError(error, `Failed to create Jira issue`);
            }
        }
    }));

    // Update Jira Issue Tool
    tools.push(vscode.lm.registerTool('updateJiraIssue', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ issueKey: string; fields: any }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Jira is not configured'));
            }
            const { issueKey, fields } = options.input;
            try {
                await helper.updateIssue(issueKey, fields);
                return createSuccessResult({ message: `Updated issue ${issueKey}` });
            } catch (error) {
                return handleToolError(error, `Failed to update Jira issue ${issueKey}`);
            }
        }
    }));

    // Delete Jira Issue Tool
    tools.push(vscode.lm.registerTool('deleteJiraIssue', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ issueKey: string; deleteSubtasks?: boolean }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Jira is not configured'));
            }
            const { issueKey, deleteSubtasks = false } = options.input;
            try {
                await helper.deleteIssue(issueKey, deleteSubtasks);
                return createSuccessResult({ message: `Deleted issue ${issueKey}` });
            } catch (error) {
                return handleToolError(error, `Failed to delete issue ${issueKey}`);
            }
        }
    }));

    // Assign Jira Issue Tool
    tools.push(vscode.lm.registerTool('assignJiraIssue', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ issueKey: string; accountId: string | null }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Jira is not configured'));
            }
            const { issueKey, accountId } = options.input;
            try {
                await helper.assignIssue(issueKey, accountId);
                const message = accountId ? `Assigned ${issueKey} to user` : `Unassigned ${issueKey}`;
                return createSuccessResult({ message });
            } catch (error) {
                return handleToolError(error, `Failed to assign issue ${issueKey}`);
            }
        }
    }));

    // Get Jira Transitions Tool
    tools.push(vscode.lm.registerTool('getJiraTransitions', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ issueKey: string }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Jira is not configured'));
            }
            const { issueKey } = options.input;
            try {
                const result = await helper.getTransitions(issueKey);
                return createSuccessResult({ transitions: result.transitions || [] });
            } catch (error) {
                return handleToolError(error, `Failed to get transitions for ${issueKey}`);
            }
        }
    }));

    // Transition Jira Issue Tool
    tools.push(vscode.lm.registerTool('transitionJiraIssue', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ issueKey: string; transitionId: string }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Jira is not configured'));
            }
            const { issueKey, transitionId } = options.input;
            try {
                await helper.transitionIssue(issueKey, transitionId);
                return createSuccessResult({ message: `Transitioned issue ${issueKey}` });
            } catch (error) {
                return handleToolError(error, `Failed to transition issue ${issueKey}`);
            }
        }
    }));

    // =========================================================================
    // GROUP 2: ISSUE CONTEXT (Links, Comments, Worklogs, etc.)
    // =========================================================================

    // Get Jira Issue Links Tool
    tools.push(vscode.lm.registerTool('getJiraIssueLinks', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ issueKey: string }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Jira is not configured'));
            }
            const { issueKey } = options.input;
            try {
                const links = await helper.getIssueLinks(issueKey);
                const formatted = links.map(link => {
                    const linkedIssue = link.outwardIssue || link.inwardIssue;
                    const linkType = link.type?.name || 'related';
                    return `${linkedIssue?.key}: ${linkedIssue?.fields?.summary} (${linkType})`;
                });
                return createSuccessResult({ links, formatted });
            } catch (error) {
                return handleToolError(error, `Failed to get links for ${issueKey}`);
            }
        }
    }));

    // Create Jira Issue Link Tool
    tools.push(vscode.lm.registerTool('createJiraIssueLink', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ inwardIssue: string; outwardIssue: string; linkType: string; comment?: string }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Jira is not configured'));
            }
            const { inwardIssue, outwardIssue, linkType, comment } = options.input;
            try {
                const result = await helper.createIssueLink(inwardIssue, outwardIssue, linkType, comment);
                return createSuccessResult({ message: `Linked ${inwardIssue} to ${outwardIssue} (${linkType})`, link: result });
            } catch (error) {
                return handleToolError(error, `Failed to create issue link`);
            }
        }
    }));

    // Gather Jira Issue Context Tool
    tools.push(vscode.lm.registerTool('gatherJiraIssueContext', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ issueKey: string }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Jira is not configured'));
            }
            const { issueKey } = options.input;
            try {
                const context = await helper.gatherIssueContext(issueKey);
                const summary = {
                    mainIssue: formatJiraIssue(context.mainIssue),
                    subTasks: formatJiraIssueSummary(context.subTasks),
                    linkedIssues: formatJiraIssueSummary(context.linkedIssues),
                    totalIssues: context.allIssues.length
                };
                return createSuccessResult({ context, summary });
            } catch (error) {
                return handleToolError(error, `Failed to gather context for ${issueKey}`);
            }
        }
    }));

    // Get Jira Comments Tool
    tools.push(vscode.lm.registerTool('getJiraComments', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ issueKey: string; maxResults?: number }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Jira is not configured'));
            }
            const { issueKey, maxResults = 50 } = options.input;
            try {
                const result = await helper.getComments(issueKey, 0, maxResults);
                return createSuccessResult({ comments: result.comments, total: result.total });
            } catch (error) {
                return handleToolError(error, `Failed to get comments for ${issueKey}`);
            }
        }
    }));

    // Create Jira Comment Tool
    tools.push(vscode.lm.registerTool('createJiraComment', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ issueKey: string; comment: string }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Jira is not configured'));
            }
            const { issueKey, comment } = options.input;
            try {
                const result = await helper.addComment(issueKey, comment);
                return createSuccessResult({ message: `Comment added to ${issueKey}`, result });
            } catch (error) {
                return handleToolError(error, `Failed to add comment to ${issueKey}`);
            }
        }
    }));

    // Get Jira Worklogs Tool
    tools.push(vscode.lm.registerTool('getJiraWorklogs', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ issueKey: string; maxResults?: number }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Jira is not configured'));
            }
            const { issueKey, maxResults = 1000 } = options.input;
            try {
                const result = await helper.getWorklogs(issueKey, 0, maxResults);
                return createSuccessResult({ worklogs: result.worklogs, total: result.total });
            } catch (error) {
                return handleToolError(error, `Failed to get worklogs for ${issueKey}`);
            }
        }
    }));

    // Add Worklog Tool
    tools.push(vscode.lm.registerTool('addJiraWorklog', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ issueKey: string; timeSpent: string; started?: string; comment?: string }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Jira is not configured'));
            }
            const { issueKey, timeSpent, started, comment } = options.input;
            try {
                const result = await helper.addWorklog(issueKey, timeSpent, started, comment);
                return createSuccessResult({ message: `Logged ${timeSpent} on ${issueKey}`, worklog: result });
            } catch (error) {
                return handleToolError(error, `Failed to add worklog to ${issueKey}`);
            }
        }
    }));

    // Get Changelog Tool
    tools.push(vscode.lm.registerTool('getJiraChangelog', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ issueKey: string; maxResults?: number }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Jira is not configured'));
            }
            const { issueKey, maxResults = 100 } = options.input;
            try {
                const result = await helper.getChangelog(issueKey, 0, maxResults);
                return createSuccessResult({ changelog: result });
            } catch (error) {
                return handleToolError(error, `Failed to get changelog for ${issueKey}`);
            }
        }
    }));

    // Get Jira Attachments Tool
    tools.push(vscode.lm.registerTool('getJiraAttachments', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ issueKey: string }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Jira is not configured'));
            }
            const { issueKey } = options.input;
            try {
                const attachments = await helper.getIssueAttachments(issueKey);
                return createSuccessResult({ attachments, count: attachments.length });
            } catch (error) {
                return handleToolError(error, `Failed to get attachments for ${issueKey}`);
            }
        }
    }));

    // Get Watchers Tool
    tools.push(vscode.lm.registerTool('getJiraWatchers', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ issueKey: string }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Jira is not configured'));
            }
            const { issueKey } = options.input;
            try {
                const result = await helper.getWatchers(issueKey);
                return createSuccessResult({ watchers: result });
            } catch (error) {
                return handleToolError(error, `Failed to get watchers for ${issueKey}`);
            }
        }
    }));

    // Add Watcher Tool
    tools.push(vscode.lm.registerTool('addJiraWatcher', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ issueKey: string; accountId: string }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Jira is not configured'));
            }
            const { issueKey, accountId } = options.input;
            try {
                await helper.addWatcher(issueKey, accountId);
                return createSuccessResult({ message: `Added watcher to ${issueKey}` });
            } catch (error) {
                return handleToolError(error, `Failed to add watcher to ${issueKey}`);
            }
        }
    }));

    // Get Jira Votes Tool
    tools.push(vscode.lm.registerTool('getJiraVotes', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ issueKey: string }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Jira is not configured'));
            }
            const { issueKey } = options.input;
            try {
                const votes = await helper.getVotes(issueKey);
                return createSuccessResult({ votes });
            } catch (error) {
                return handleToolError(error, `Failed to get votes for ${issueKey}`);
            }
        }
    }));

    // =========================================================================
    // GROUP 3: PROJECT OPERATIONS
    // =========================================================================

    // Get Jira Project Tool
    tools.push(vscode.lm.registerTool('getJiraProject', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ projectKey: string; expand?: string[] }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Jira is not configured'));
            }
            const { projectKey, expand } = options.input;
            try {
                const project = await helper.getProject(projectKey, expand);
                return createSuccessResult({ project });
            } catch (error) {
                return handleToolError(error, `Failed to get project ${projectKey}`);
            }
        }
    }));

    // Get Project Summary Tool
    tools.push(vscode.lm.registerTool('getProjectSummary', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ projectKey: string }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Jira is not configured'));
            }
            const { projectKey } = options.input;
            try {
                const summary = await helper.getProjectSummary(projectKey);
                const percentDone = summary.issueCount.total > 0
                    ? Math.round((summary.issueCount.done / summary.issueCount.total) * 100)
                    : 0;
                return createSuccessResult({
                    project: summary.project,
                    issueCount: summary.issueCount,
                    percentDone,
                    recentActivity: formatJiraIssueSummary(summary.recentActivity)
                });
            } catch (error) {
                return handleToolError(error, `Failed to get summary for project ${projectKey}`);
            }
        }
    }));

    // Get Project Components Tool
    tools.push(vscode.lm.registerTool('getProjectComponents', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ projectKey: string }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Jira is not configured'));
            }
            const { projectKey } = options.input;
            try {
                const components = await helper.getProjectComponents(projectKey);
                return createSuccessResult({ components, count: components.length });
            } catch (error) {
                return handleToolError(error, `Failed to get components for project ${projectKey}`);
            }
        }
    }));

    // Create Project Component Tool
    tools.push(vscode.lm.registerTool('createProjectComponent', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ projectKey: string; name: string; description?: string; leadAccountId?: string }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Jira is not configured'));
            }
            const { projectKey, name, description, leadAccountId } = options.input;
            try {
                const component = await helper.createComponent(projectKey, name, { description, leadAccountId });
                return createSuccessResult({ message: `Created component ${name}`, component });
            } catch (error) {
                return handleToolError(error, `Failed to create component in ${projectKey}`);
            }
        }
    }));

    // Update Project Component Tool
    tools.push(vscode.lm.registerTool('updateProjectComponent', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ componentId: string; name?: string; description?: string; leadAccountId?: string }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Jira is not configured'));
            }
            const { componentId, name, description, leadAccountId } = options.input;
            try {
                const component = await helper.updateComponent(componentId, { name, description, leadAccountId });
                return createSuccessResult({ message: `Updated component ${componentId}`, component });
            } catch (error) {
                return handleToolError(error, `Failed to update component ${componentId}`);
            }
        }
    }));

    // Delete Project Component Tool
    tools.push(vscode.lm.registerTool('deleteProjectComponent', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ componentId: string; moveIssuesTo?: string }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Jira is not configured'));
            }
            const { componentId, moveIssuesTo } = options.input;
            try {
                await helper.deleteComponent(componentId, moveIssuesTo);
                return createSuccessResult({ message: `Deleted component ${componentId}` });
            } catch (error) {
                return handleToolError(error, `Failed to delete component ${componentId}`);
            }
        }
    }));

    // Get Project Statuses Tool
    tools.push(vscode.lm.registerTool('getProjectStatuses', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ projectKey: string }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Jira is not configured'));
            }
            const { projectKey } = options.input;
            try {
                const statuses = await helper.getProjectStatuses(projectKey);
                return createSuccessResult({ statuses, count: statuses.length });
            } catch (error) {
                return handleToolError(error, `Failed to get statuses for project ${projectKey}`);
            }
        }
    }));

    // =========================================================================
    // GROUP 4: VERSION MANAGEMENT
    // =========================================================================

    // Get Project Versions Tool
    tools.push(vscode.lm.registerTool('getProjectVersions', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ projectKey: string }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Jira is not configured'));
            }
            const { projectKey } = options.input;
            try {
                const versions = await helper.getProjectVersions(projectKey);
                return createSuccessResult({ versions, count: versions.length });
            } catch (error) {
                return handleToolError(error, `Failed to get versions for project ${projectKey}`);
            }
        }
    }));

    // Create Version Tool
    tools.push(vscode.lm.registerTool('createVersion', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ projectKey: string; name: string; description?: string; startDate?: string; releaseDate?: string; released?: boolean }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Jira is not configured'));
            }
            const { projectKey, name, description, startDate, releaseDate, released } = options.input;
            try {
                const version = await helper.createVersion(projectKey, name, { description, startDate, releaseDate, released });
                return createSuccessResult({ message: `Created version ${name}`, version });
            } catch (error) {
                return handleToolError(error, `Failed to create version in ${projectKey}`);
            }
        }
    }));

    // Update Version Tool
    tools.push(vscode.lm.registerTool('updateVersion', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ versionId: string; name?: string; description?: string; startDate?: string; releaseDate?: string; released?: boolean; archived?: boolean }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Jira is not configured'));
            }
            const { versionId, name, description, startDate, releaseDate, released, archived } = options.input;
            try {
                const version = await helper.updateVersion(versionId, { name, description, startDate, releaseDate, released, archived });
                return createSuccessResult({ message: `Updated version ${versionId}`, version });
            } catch (error) {
                return handleToolError(error, `Failed to update version ${versionId}`);
            }
        }
    }));

    // Delete Version Tool
    tools.push(vscode.lm.registerTool('deleteVersion', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ versionId: string; moveFixIssuesTo?: string; moveAffectedIssuesTo?: string }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Jira is not configured'));
            }
            const { versionId, moveFixIssuesTo, moveAffectedIssuesTo } = options.input;
            try {
                await helper.deleteVersion(versionId, moveFixIssuesTo, moveAffectedIssuesTo);
                return createSuccessResult({ message: `Deleted version ${versionId}` });
            } catch (error) {
                return handleToolError(error, `Failed to delete version ${versionId}`);
            }
        }
    }));

    // Release Version Tool
    tools.push(vscode.lm.registerTool('releaseVersion', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ versionId: string }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Jira is not configured'));
            }
            const { versionId } = options.input;
            try {
                const version = await helper.releaseVersion(versionId);
                return createSuccessResult({ message: `Released version ${versionId}`, version });
            } catch (error) {
                return handleToolError(error, `Failed to release version ${versionId}`);
            }
        }
    }));

    // Get Version Progress Tool
    tools.push(vscode.lm.registerTool('getVersionProgress', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ versionId: string }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Jira is not configured'));
            }
            const { versionId } = options.input;
            try {
                const [version, relatedIssues, unresolvedCount] = await Promise.all([
                    helper.getVersion(versionId),
                    helper.getVersionRelatedIssues(versionId),
                    helper.getVersionUnresolvedIssues(versionId)
                ]);
                return createSuccessResult({ version, relatedIssues, unresolvedCount });
            } catch (error) {
                return handleToolError(error, `Failed to get progress for version ${versionId}`);
            }
        }
    }));

    // =========================================================================
    // GROUP 5: EPIC MANAGEMENT
    // =========================================================================

    // Get Project Epics Tool
    tools.push(vscode.lm.registerTool('getProjectEpics', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ projectKey: string; maxResults?: number }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Jira is not configured'));
            }
            const { projectKey, maxResults = 50 } = options.input;
            try {
                const epics = await helper.getEpics(projectKey, maxResults);
                const summary = formatJiraIssueSummary(epics);
                return createSuccessResult({ epics, count: epics.length, summary });
            } catch (error) {
                return handleToolError(error, `Failed to get epics for project ${projectKey}`);
            }
        }
    }));

    // Create Epic Tool
    tools.push(vscode.lm.registerTool('createEpic', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ projectKey: string; summary: string; description?: string }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Jira is not configured'));
            }
            const { projectKey, summary, description } = options.input;
            try {
                const epic = await helper.createEpic(projectKey, summary, description);
                const formatted = formatJiraIssue(epic);
                return createSuccessResult({ message: `Created epic ${epic.key}`, epic, formatted });
            } catch (error) {
                return handleToolError(error, `Failed to create epic in ${projectKey}`);
            }
        }
    }));

    // Get Epic Progress Tool
    tools.push(vscode.lm.registerTool('getEpicProgress', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ epicKey: string }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Jira is not configured'));
            }
            const { epicKey } = options.input;
            try {
                const epicDetails = await helper.getEpicDetails(epicKey);
                const percentComplete = epicDetails.progress.total > 0
                    ? Math.round((epicDetails.progress.done / epicDetails.progress.total) * 100)
                    : 0;
                return createSuccessResult({
                    epic: formatJiraIssue(epicDetails.epic),
                    childIssues: formatJiraIssueSummary(epicDetails.childIssues),
                    progress: {
                        ...epicDetails.progress,
                        percentComplete
                    }
                });
            } catch (error) {
                return handleToolError(error, `Failed to get epic progress for ${epicKey}`);
            }
        }
    }));

    // Get All Epics Progress Tool
    tools.push(vscode.lm.registerTool('getEpicsProgress', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ projectKey: string }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Jira is not configured'));
            }
            const { projectKey } = options.input;
            try {
                const epicsProgress = await helper.getEpicsProgress(projectKey);
                const formatted = epicsProgress.map(ep => ({
                    key: ep.epic.key,
                    summary: ep.epic.fields.summary,
                    status: ep.epic.fields.status.name,
                    progress: ep.progress
                }));
                return createSuccessResult({
                    epics: epicsProgress,
                    summary: formatted,
                    totalEpics: epicsProgress.length
                });
            } catch (error) {
                return handleToolError(error, `Failed to get epic progress for project ${projectKey}`);
            }
        }
    }));

    // Get Epic Issues Tool
    tools.push(vscode.lm.registerTool('getEpicIssues', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ epicKey: string; maxResults?: number }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Jira is not configured'));
            }
            const { epicKey, maxResults = 100 } = options.input;
            try {
                const issues = await helper.getEpicIssues(epicKey, maxResults);
                const summary = formatJiraIssueSummary(issues);
                return createSuccessResult({ issues, count: issues.length, summary });
            } catch (error) {
                return handleToolError(error, `Failed to get issues for epic ${epicKey}`);
            }
        }
    }));

    // Add Issue to Epic Tool
    tools.push(vscode.lm.registerTool('addIssueToEpic', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ epicKey: string; issueKey: string }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Jira is not configured'));
            }
            const { epicKey, issueKey } = options.input;
            try {
                await helper.addIssueToEpic(epicKey, issueKey);
                return createSuccessResult({ message: `Added ${issueKey} to epic ${epicKey}` });
            } catch (error) {
                return handleToolError(error, `Failed to add ${issueKey} to epic ${epicKey}`);
            }
        }
    }));

    // Remove Issue from Epic Tool
    tools.push(vscode.lm.registerTool('removeIssueFromEpic', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ issueKey: string }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Jira is not configured'));
            }
            const { issueKey } = options.input;
            try {
                await helper.removeIssueFromEpic(issueKey);
                return createSuccessResult({ message: `Removed ${issueKey} from epic` });
            } catch (error) {
                return handleToolError(error, `Failed to remove ${issueKey} from epic`);
            }
        }
    }));

    // =========================================================================
    // GROUP 6: SEARCH & METADATA
    // =========================================================================

    // Search Jira Issues Tool
    tools.push(vscode.lm.registerTool('searchJiraIssues', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ jql: string; maxResults?: number }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Jira is not configured'));
            }
            const { jql, maxResults = 50 } = options.input;
            try {
                const result = await helper.searchIssues(jql, maxResults);
                const summary = formatJiraIssueSummary(result.issues);
                return createSuccessResult({ total: result.total, issues: result.issues, summary });
            } catch (error) {
                return handleToolError(error, `Failed to search Jira issues with JQL: ${jql}`);
            }
        }
    }));

    // Bulk Fetch Issues Tool
    tools.push(vscode.lm.registerTool('bulkFetchJiraIssues', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ issueKeys: string[]; fields?: string[] }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Jira is not configured'));
            }
            const { issueKeys, fields } = options.input;
            try {
                const result = await helper.bulkFetchIssues(issueKeys, fields);
                return createSuccessResult({ issues: result.issues, errors: result.errors });
            } catch (error) {
                return handleToolError(error, `Failed to bulk fetch issues`);
            }
        }
    }));

    // Get Create Metadata Tool
    tools.push(vscode.lm.registerTool('getJiraCreateMetadata', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ projectKeys?: string[]; issueTypeNames?: string[] }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Jira is not configured'));
            }
            const { projectKeys, issueTypeNames } = options.input;
            try {
                const result = await helper.getCreateMetadata(projectKeys, issueTypeNames);
                return createSuccessResult({ metadata: result });
            } catch (error) {
                return handleToolError(error, `Failed to get create metadata`);
            }
        }
    }));

    // Find Assignable Users Tool
    tools.push(vscode.lm.registerTool('findJiraAssignableUsers', {
        async invoke(options: vscode.LanguageModelToolInvocationOptions<{ query: string; project?: string; issueKey?: string; maxResults?: number }>, _token: vscode.CancellationToken) {
            if (!helper) {
                return handleToolError(new Error('Jira is not configured'));
            }
            const { query, project, issueKey, maxResults = 50 } = options.input;
            try {
                const users = await helper.findAssignableUsers(query, project, issueKey, maxResults);
                return createSuccessResult({ users });
            } catch (error) {
                return handleToolError(error, `Failed to find assignable users`);
            }
        }
    }));

    // Register all tools
    context.subscriptions.push(...tools);
}
