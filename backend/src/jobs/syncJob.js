/**
 * Scheduled Jobs
 * Uses node-cron to run background tasks on schedule.
 *
 * Jobs:
 * 1. Every 6 hours: Sync GitHub data for all active projects
 * 2. Every 12 hours: Re-analyze risk for all active sprints
 * 3. Daily at midnight: Compute team benchmarks
 */
const cron = require('node-cron');
const Sprint = require('../models/Sprint');
const Project = require('../models/Project');
const Team = require('../models/Team');
const PullRequest = require('../models/PullRequest');
const mlService = require('../services/mlService');

let jobsRegistered = false;

/**
 * Register all cron jobs.
 * Call this once after database connections are established.
 */
function registerJobs() {
  if (jobsRegistered) return;
  jobsRegistered = true;

  console.log('📅 Registering scheduled jobs...');

  // ── Job 1: Sync GitHub data every 6 hours ────────────────
  cron.schedule('0 */6 * * *', async () => {
    console.log('\n⏰ [CRON] Starting GitHub sync for active projects...');
    try {
      const projects = await Project.find({
        status: 'active',
        githubRepo: { $ne: '', $exists: true },
        isActive: true,
      });

      console.log(`   Found ${projects.length} active projects with GitHub repos`);

      // Note: Actual sync requires a GitHub token per project/user.
      // In production, this would use a bot token stored per org.
      // For MVP, we log what would be synced.
      for (const project of projects) {
        console.log(`   📦 Would sync: ${project.name} (${project.githubRepo})`);
      }

      console.log(`✅ [CRON] GitHub sync check complete: ${projects.length} projects`);
    } catch (error) {
      console.error('❌ [CRON] GitHub sync failed:', error.message);
    }
  });

  // ── Job 2: Re-analyze risk every 12 hours ────────────────
  cron.schedule('0 */12 * * *', async () => {
    console.log('\n⏰ [CRON] Starting risk re-analysis for active sprints...');
    try {
      const activeSprints = await Sprint.find({ status: 'active' })
        .populate('teamId', 'name members');

      let analyzed = 0;
      let highRisk = 0;

      for (const sprint of activeSprints) {
        try {
          const teamSize = sprint.teamId?.members?.length || 1;

          const sprintData = {
            sprintId: sprint._id.toString(),
            sprintName: sprint.name,
            sprintGoal: sprint.name,
            sprintDays: Math.ceil(
              (new Date(sprint.endDate) - new Date(sprint.startDate)) / (1000 * 60 * 60 * 24)
            ),
            daysRemaining: sprint.daysRemaining || 7,
            teamSize,
            plannedPoints: sprint.plannedPoints || 0,
            completedPoints: sprint.completedPoints || 0,
            tickets: (sprint.tickets || []).map((t) => ({
              title: t.title,
              description: t.title,
              status: t.status,
              addedMidSprint: t.addedMidSprint || false,
              reopenedCount: t.reopenedCount || 0,
            })),
            commits: (sprint.commits || []).map((c) => ({
              message: c.message,
              author: c.author,
              additions: c.additions || 0,
              deletions: c.deletions || 0,
              files: [],
            })),
            pullRequests: [],
          };

          // Get PR data
          const prs = await PullRequest.find({ sprintId: sprint._id });
          sprintData.pullRequests = prs.map((pr) => ({
            title: pr.title,
            status: pr.status,
            reviewLagHours: pr.reviewLagHours,
            additions: pr.additions,
            deletions: pr.deletions,
          }));

          const result = await mlService.analyzeSprintRisk(sprintData);
          if (result) {
            sprint.riskScore = result.risk_score;
            sprint.riskLevel = result.risk_level;
            sprint.riskFactors = (result.risk_factors || []).map(
              (f) => `${f.factor}: ${f.description}`
            );
            await sprint.save();
            analyzed++;

            if (result.risk_level === 'high' || result.risk_level === 'critical') {
              highRisk++;
            }
          }
        } catch (sprintError) {
          console.warn(`   ⚠️ Failed to analyze sprint ${sprint.name}: ${sprintError.message}`);
        }
      }

      console.log(
        `✅ [CRON] Risk re-analysis complete: ` +
        `Re-analyzed ${analyzed} sprints, ${highRisk} are now high/critical risk`
      );
    } catch (error) {
      console.error('❌ [CRON] Risk re-analysis failed:', error.message);
    }
  });

  // ── Job 3: Daily benchmarks at midnight ──────────────────
  cron.schedule('0 0 * * *', async () => {
    console.log('\n⏰ [CRON] Starting daily team benchmark computation...');
    try {
      const teams = await Team.find({ isActive: true });
      let computed = 0;

      for (const team of teams) {
        try {
          const recentSprints = await Sprint.find({
            teamId: team._id,
            status: 'completed',
          }).sort({ endDate: -1 }).limit(10);

          if (recentSprints.length === 0) continue;

          const totalCompleted = recentSprints.reduce(
            (s, sp) => s + (sp.completedPoints || 0), 0
          );
          const totalPlanned = recentSprints.reduce(
            (s, sp) => s + (sp.plannedPoints || 0), 0
          );

          const result = await mlService.computeBenchmark({
            sprint_completion_rate: totalPlanned > 0 ? totalCompleted / totalPlanned : 0,
            team_size: team.members?.length || 1,
          });

          if (result) {
            computed++;
            console.log(
              `   📊 ${team.name}: health=${result.health_score}, grade=${result.health_grade}`
            );
          }
        } catch (teamError) {
          console.warn(`   ⚠️ Failed benchmark for team ${team.name}: ${teamError.message}`);
        }
      }

      console.log(`✅ [CRON] Daily benchmarks complete: ${computed} teams computed`);
    } catch (error) {
      console.error('❌ [CRON] Daily benchmarks failed:', error.message);
    }
  });

  console.log('✅ Scheduled jobs registered:');
  console.log('   • GitHub sync: every 6 hours');
  console.log('   • Risk re-analysis: every 12 hours');
  console.log('   • Team benchmarks: daily at midnight');
}

module.exports = { registerJobs };
