import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import Management from '@/app/franchise/page';
import Profile from '@/app/profile/agency/page';
const mocks=vi.hoisted(()=>({get:vi.fn(),franchises:vi.fn(),users:vi.fn(),user:{id:'admin',role:'SUPER_ADMIN',franchiseId:'branch-a'},params:new URLSearchParams()}));
vi.mock('@/context/AuthContext',()=>({useAuth:()=>({user:mocks.user})}));
vi.mock('next/navigation',()=>({useRouter:()=>({replace:vi.fn(),push:vi.fn()}),useSearchParams:()=>mocks.params}));
vi.mock('@/lib/api',()=>({default:{get:mocks.get},franchiseApi:{getAll:mocks.franchises},userGovernanceApi:{getAll:mocks.users}}));
vi.mock('../FranchisePhoto',()=>({default:()=> <span>Branch Photo</span>}));
vi.mock('../FranchiseDocuments',()=>({default:({franchiseId,manage}:any)=><div role="region" aria-label="Documents panel">{franchiseId} · {manage?'manage':'read only'}</div>}));
const branch=(id:string,name:string)=>({id,name,location:id,ownerName:'Owner',contactNum:'1234567890',status:'ACTIVE'});
beforeEach(()=>{vi.clearAllMocks();mocks.user={id:'admin',role:'SUPER_ADMIN',franchiseId:'branch-a'};mocks.franchises.mockResolvedValue({data:[branch('branch-a','Branch A'),branch('branch-b','Branch B')]});mocks.users.mockResolvedValue({data:[]});mocks.get.mockImplementation(async(url:string)=>({data:url==='/api/me'?{...mocks.user,fullName:'Owner',email:'owner@example.test',franchise:branch('branch-a','Branch A')}:[]}));});
afterEach(cleanup);
it('opens Update Documents for the chosen franchise and preserves the other settings tabs',async()=>{
  render(<Management/>);await screen.findByRole('heading',{name:'Branch B'});
  const card=screen.getByRole('heading',{name:'Branch B'}).closest('div.rounded-2xl')!;
  fireEvent.click(within(card as HTMLElement).getByRole('button',{name:'Update Documents'}));
  expect(await screen.findByRole('region',{name:'Documents panel'})).toHaveTextContent('branch-b · manage');
  expect(screen.queryByRole('button',{name:'Save Franchise'})).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Branch Details'}));expect(screen.getByPlaceholderText('e.g. Coimbatore Main')).toHaveValue('Branch B');expect(screen.getByLabelText('Franchise Photo')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Administrators'}));expect(await screen.findByText('Branch Administrators')).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'Documents'}));expect(screen.getByRole('region',{name:'Documents panel'})).toHaveTextContent('branch-b');
});
it('shows read-only documents in the authenticated franchise branch profile',async()=>{
  mocks.user={id:'owner',role:'FRANCHISE_ADMIN',franchiseId:'branch-a'};
  render(<Profile/>);fireEvent.click(await screen.findByRole('button',{name:/Branch Profile/i}));
  expect(await screen.findByRole('region',{name:'Documents panel'})).toHaveTextContent('branch-a · read only');
});
