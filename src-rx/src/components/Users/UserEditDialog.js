import Dialog from '@material-ui/core/Dialog';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';

import {UsersTextField} from './Fields';

function UserEditDialog(props) {
    return props.open ? <Dialog open={props.open} onClose={props.onClose}>
        <Box className={props.classes.dialog}>
            <UsersTextField 
                label="Name" 
                t={props.t} 
                value={ props.user.common.name }
                onChange={e=>{
                    let newData = props.user;
                    newData.common.name = e.target.value;
                    props.change(newData);
                }}
                classes={props.classes}
            />
            <UsersTextField 
                label="ID" 
                t={props.t} 
                value={ props.user.common._id }
                classes={props.classes}
            />
            <UsersTextField 
                label="Description" 
                t={props.t} 
                value={ props.user.common.desc }
                onChange={e=>{
                    let newData = props.user;
                    newData.common.desc = e.target.value;
                    props.change(newData);
                }}
                classes={props.classes}
            />
            <UsersTextField 
                label="Password" 
                t={props.t} 
                value={ props.user.common.password }
                onChange={e=>{
                    let newData = props.user;
                    newData.common.password = e.target.value;
                    props.change(newData);
                }}
                type="password"
                classes={props.classes}
            />
            <UsersTextField 
                label="Password repeat" 
                t={props.t} 
                value={ props.user.common.passwordRepeat }
                onChange={e=>{
                    let newData = props.user;
                    newData.common.passwordRepeat = e.target.value;
                    props.change(newData);
                }}
                type="password"
                classes={props.classes}
            />
            <UsersTextField 
                label="Icon" 
                t={props.t} 
                value={ props.user.common.icon }
                onChange={e=>{
                    let newData = props.user;
                    newData.common.icon = e.target.value;
                    props.change(newData);
                }}
                classes={props.classes}
            />
            <UsersTextField 
                label="Color" 
                t={props.t} 
                value={ props.user.common.color }
                onChange={e=>{
                    let newData = props.user;
                    newData.common.color = e.target.value;
                    props.change(newData);
                }}
                classes={props.classes}
            />
            <Button onClick={props.saveData} disabled={props.user.common.password != props.user.common.passwordRepeat}>Save</Button>
        </Box>
    </Dialog> : null;
}

export default UserEditDialog;