import {useState} from 'react';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import FranchisePhotoUpload,{MAX_FRANCHISE_PHOTO_BYTES,photoPayload} from '../FranchisePhotoUpload';
import FranchisePhoto from '../FranchisePhoto';

const mock=vi.hoisted(()=>({get:vi.fn()}));
vi.mock('@/lib/api/base',()=>({default:{get:mock.get}}));
const reference={id:'photo-id',url:'/api/franchise/branch-id/photo?v=photo-id'};
describe('optional franchise photo',()=>{
  const create=vi.fn(()=> 'blob:photo-preview'),revoke=vi.fn();
  beforeEach(()=>{vi.clearAllMocks();Object.defineProperty(URL,'createObjectURL',{configurable:true,value:create});Object.defineProperty(URL,'revokeObjectURL',{configurable:true,value:revoke});mock.get.mockResolvedValue({data:new Blob(['png'],{type:'image/png'})});});
  afterEach(cleanup);
  const setup=(existing=false,disabled=false)=>{
    const changed=vi.fn();
    const Harness=()=>{const [file,setFile]=useState<File | null>(null),[removed,setRemoved]=useState(false);return <FranchisePhotoUpload file={file} photo={existing?reference:null} removed={removed} disabled={disabled} onChange={next=>{changed(next);setFile(next);setRemoved(next===null);}}/>;};
    render(<Harness/>);return changed;
  };
  it('starts optional with a placeholder and performs no upload',()=>{
    setup();expect(screen.getByText('(Optional)')).toBeInTheDocument();expect(screen.getByLabelText('Default franchise photo')).toBeInTheDocument();expect(screen.getByRole('button',{name:'Upload Photo'})).toBeEnabled();expect(mock.get).not.toHaveBeenCalled();
  });
  it.each(['jpg','jpeg','png','webp'])('previews a selected %s file without stretching',async extension=>{
    const changed=setup();const file=new File(['image'],`branch.${extension}`,{type:extension==='png'?'image/png':extension==='webp'?'image/webp':'image/jpeg'});
    fireEvent.change(screen.getByLabelText('Franchise Photo'),{target:{files:[file]}});
    expect(changed).toHaveBeenCalledWith(file);expect(await screen.findByRole('img',{name:'Franchise photo'})).toHaveClass('object-contain');expect(screen.getByRole('button',{name:'Change Photo'})).toBeInTheDocument();expect(mock.get).not.toHaveBeenCalled();
  });
  it('rejects unsupported and oversized files and leaves the saved photo intact',async()=>{
    const changed=setup(true);await screen.findByRole('img');
    fireEvent.change(screen.getByLabelText('Franchise Photo'),{target:{files:[new File(['svg'],'branch.svg',{type:'image/svg+xml'})]}});expect(screen.getByRole('alert')).toHaveTextContent('Only JPG');expect(changed).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Franchise Photo'),{target:{files:[new File([new Uint8Array(MAX_FRANCHISE_PHOTO_BYTES+1)],'branch.png',{type:'image/png'})]}});expect(screen.getByRole('alert')).toHaveTextContent('5 MB');expect(changed).not.toHaveBeenCalled();expect(screen.getByRole('img')).toBeInTheDocument();
  });
  it('supports drag/drop, replacement, removal and object URL cleanup',async()=>{
    const changed=setup();const first=new File(['one'],'one.png',{type:'image/png'}),second=new File(['two'],'two.webp',{type:'image/webp'});
    fireEvent.drop(screen.getByRole('group',{name:'Franchise photo upload'}),{dataTransfer:{files:[first]}});await screen.findByRole('img');
    fireEvent.change(screen.getByLabelText('Franchise Photo'),{target:{files:[second]}});expect(changed).toHaveBeenLastCalledWith(second);await waitFor(()=>expect(revoke).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button',{name:'Remove Photo'}));expect(changed).toHaveBeenLastCalledWith(null);expect(screen.getByLabelText('Default franchise photo')).toBeInTheDocument();
  });
  it('loads saved private images through the authenticated client and retains them untouched',async()=>{
    const changed=setup(true);await screen.findByRole('img');expect(mock.get).toHaveBeenCalledWith(reference.url,{responseType:'blob'});expect(changed).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Remove Photo'}));expect(changed).toHaveBeenCalledWith(null);
  });
  it('ignores drops while saving',()=>{
    const changed=setup(false,true);fireEvent.drop(screen.getByRole('group'),{dataTransfer:{files:[new File(['x'],'x.png',{type:'image/png'})]}});expect(changed).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:'Upload Photo'})).toBeDisabled();
  });
  it('encodes only when saving, and keeps the original file bytes',async()=>{
    const result=await photoPayload(new File(['image bytes'],'branch.png',{type:'image/png'}));expect(result).toEqual({fileName:'branch.png',mimeType:'image/png',dataBase64:btoa('image bytes')});
  });
  it('falls back gracefully when the saved image cannot be read',async()=>{
    mock.get.mockRejectedValue(new Error('Unavailable'));render(<FranchisePhoto photo={reference} className="h-20 w-20"/>);expect(await screen.findByLabelText('Default franchise photo')).toBeInTheDocument();expect(screen.queryByRole('img')).toBeNull();
  });
});
