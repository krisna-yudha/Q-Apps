// Clean default data for development
export const initialMockData = {
  users: [
    {
      id: 1,
      name: 'Supervisor',
      email: 'supervisor@digiqa.id',
      username: 'supervisor',
      role: 'supervisor',
      avatar: null,
      status: 'active'
    },
    {
      id: 2,
      name: 'Quality Assurance',
      email: 'qa@digiqa.id',
      username: 'qa',
      role: 'quality_assurance',
      avatar: null,
      status: 'active'
    },
    {
      id: 3,
      name: 'Team Leader',
      email: 'teamleader@digiqa.id',
      username: 'team_leader',
      role: 'team_leader',
      avatar: null,
      status: 'active'
    }
  ],
  teamLeaders: [],
  trainers: [],
  monthlyGlobalTrends: [],
  agents: [],
  evaluatorsSampling: [],
  policyDiscussions: []
};
