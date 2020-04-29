const express = require("express");
const http = require("http");
const cron = require("node-cron");
const fs = require("fs");
var async = require('async');

const app = express();
var bodyParser = require("body-parser");
var cors = require("cors")
const server = http.createServer(app);
const vars = require('./sdk/vars.js');
var HashMap = require('hashmap');
var HashSet = require('hashset');


const RegistryService = require('./sdk/RegistryService')
const KeycloakHelper = require('./sdk/KeycloakHelper')

app.use(cors())
app.use(express.static('public'))
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const port =vars.port;
const keycloakHelper = new KeycloakHelper(vars.keycloak);
var registryService = new RegistryService();



app.get("/school/getChart", (req, res) => {

    fs.readFile('./data/school-stackbar.json', (err, data) => {
        if (err) throw err;
        let student = JSON.parse(data);
        res.send(student);
        console.log(student);
    });


})

app.get("/course/getChart", (req, res) => {

    fs.readFile('./data/course-bar.json', (err, data) => {
        if (err) throw err;
        let student = JSON.parse(data);
        res.send(student);
        console.log(student);
    });

})


const readSchoolData =(token,callback)=>{

    var searchReq={
            body:{
            id:"open-saber.registry.search",
            request:{
                entityType:["School"],
                filters:{
    
                }
            }
        },
        headers:getDefaultHeaders(token)
    }

    registryService.searchRecord(searchReq, function (err, res) {
        if (res && res.params.status === 'SUCCESSFUL') {
            let resBody = res.result.School
            if (resBody.length > 0) {
               callback(null,resBody,token)
            } else {
                callback(null, { body: { recordVerified: false, errMsg: "School doesn't exist" }, statusCode: 200 })
            }

        } else {
            callback(null, { body: { errMsg: "Error while fetching data" }, statusCode: 500 })
        }
    });

}

const getTeacherDetailBySchool = (schoolId,headers, callback) => {

    
    const filterVariable = {}
    if(schoolId != undefined){
        filterVariable['schoolId']={eq:schoolId} 
    }              
    
    let teacherReq = {
        body: {
            id: "open-saber.registry.search",
            request: {
               entityType:["Teacher"],
               filters:filterVariable
            }
        },
        headers: headers
    }
    registryService.searchRecord(teacherReq, (err, res) => {
        if (res.params.status == 'SUCCESSFUL') {
            
            var teachers =res.result.Teacher;
            
            callback(null, teachers)
        } else {
            callback({ body: { errMsg: "teacher code update failed" }, statusCode: 500 }, null)
        }
    });
}

const readTeachersData=(schoolList,token,callback)=>{

     var tasks=[];
   
     headers = getDefaultHeaders(token);
     
     schoolList.forEach(school => {
     tasks.push(function(callback){
          getTeacherDetailBySchool(school.osid,headers,callback);  
      });         
    });
    async.parallel(tasks,function(err, results) {
            var resObj = {School:schoolList,Teacher:results}
            callback(null,resObj,token)
            
    });
    
}

const readTeachersCompleteData=(token,callback)=>{

    const filterVariable = {}              
    
    let teacherReq = {
        body: {
            id: "open-saber.registry.search",
            request: {
               entityType:["Teacher"],
               filters:{

               }
            }
        },
        headers: getDefaultHeaders(token)
    }
    registryService.searchRecord(teacherReq, (err, res) => {
        if (res.params.status == 'SUCCESSFUL') {
            
            var teachers =res.result.Teacher;
            
            callback(null, teachers,token)
        } else {
            callback({ body: { errMsg: "teacher code update failed" }, statusCode: 500 }, null)
        }
    });
   
}
const getTeacherCoursesById =(teacherId,headers,callback)=>{

    var readReq={
            body:{
            id:"open-saber.registry.read",
            request:{
                Teacher:{
                    osid:teacherId
                }
            }
        },
        headers:headers
    }

    registryService.readRecord(readReq, function (err, res) {
        if (res && res.params.status === 'SUCCESSFUL') {
            let resBody = res.result.Teacher
            callback(null,resBody)           

        } else {
            callback(null, { body: { errMsg: "Error while fetching data" }, statusCode: 500 })
        }
    });

}




const readCourseDetailsFromTeachers=(teacherList,token,callback)=>{

    var tasks=[];
  
    headers = getDefaultHeaders(token);
    
    teacherList.forEach(teacher => {
    tasks.push(function(callback){
        getTeacherCoursesById(teacher.osid,headers,callback);  
     });         
   });
   async.parallelLimit(tasks,4,function(err, results) {
           callback(null,results)
           
   });
   
}


const readTeachingRole=(teacherSchoolDetails,token,callback)=>{

    var tasks=[];
  
    headers = getDefaultHeaders(token);
    var teachers = []
    teacherSchoolDetails.Teacher.forEach(element=>{

        element.forEach(e=>{
            teachers.push(e);
        })
    }) 

    teachers.forEach(teacher => {
        tasks.push(function(callback){
            getTeacherCoursesById(teacher.osid,headers,callback);  
        });         
    });
   async.parallelLimit(tasks,4,function(err, results) {
           teacherSchoolDetails.Teacher = results
           callback(null,teacherSchoolDetails)
           
   });
   
}

const writeObjectToChartJsFormat=(teacherSchoolDetails,callback)=>{
     
       const schools = teacherSchoolDetails.School;
       var teachers = []
       teacherSchoolDetails.Teacher.forEach(element=>{

          
               teachers.push(element);
           
       })      

       var teacherSchool=[]
       var courseSet = new HashSet();
       schools.forEach(school=>{
          var schoolD ={schoolId:school.osid, schoolName:school.name,teachers:[]};
          teachers.forEach(teacher=>{
              if(teacher.schoolId == school.osid){
                  schoolD.teachers.push(teacher)
              }
          })

          //Get subject count for each school
          var map = new HashMap();
          schoolD.teachers.forEach(teacher=>{

               teacher.teachingRole.appointedForSubjects.forEach(subject=>{
                   courseSet.add(subject);
                   if(map.has(subject)){
                       map.set(subject,map.get(subject)+1);
                   }else{
                       map.set(subject,1);
                   }
               })
          });

          map.forEach(function(key,value){
              schoolD[value]= key
          });

          teacherSchool.push(schoolD);
       })

       var datasets = []
       schoolSet = new HashSet();
       var chartLabels = []
       courseSet.toArray().forEach(course=>{
            var setData ={label:course,stack:'1',data:[]}

            teacherSchool.forEach(school=>{
                if(!schoolSet.contains(school.schoolName)){
                    chartLabels.push(school.schoolName);
                    schoolSet.add(school.schoolName)
                }
                setData.data.push(school[course]== undefined? 0 : school[course]);
            })

            datasets.push(setData);

       })   
       
       let data ={
           chartLabels:chartLabels,
           datasets:datasets
       }
       callback(null,data);

}

const writeCoursesCountToJson=(teachers,callback)=>{     
     

    var courseSet = new HashSet();
    var map = new HashMap();

    teachers.forEach(teacher=>{
      
       //Get subject count for each school
       if(teacher.courses ){
        
            teacher.courses.forEach(course=>{

                if(map.has(course.courseName)){
                    map.set(course.courseName,map.get(course.courseName)+1);
                }else{
                    map.set(course.courseName,1);
                }
            });
      }
     
    })

    var datasets = []
    schoolSet = new HashSet();
    var chartLabels = []
    var setData = {data:[],minBarLength:2,label:"No. of Teachers enrolled", stack:'1',backgroundColor: "#F6C23E"};

    map.forEach(function(key,value){
        
        chartLabels.push(value);
        setData.data.push(key);

    });
    datasets.push(setData);
    
    let data ={
        chartLabels:chartLabels,
        datasets:datasets
    }
    callback(null,data);

}


const getTokenDetails = (callback) => {
    keycloakHelper.getToken(function (err, token) {
        if (token) {
            callback(null, 'Bearer ' + token.access_token.token);
        } else {
            callback(null, null);
        }
    });
}

const writeSchoolSubjectData =()=>{
     
    //Get school details
    
    async.waterfall([
        function (callback) {
            getTokenDetails(callback)
        },
        function(token,callback){
            readSchoolData(token,callback);
        },
        function(schoolList,token,callback){
            if(schoolList && schoolList.length > 0){

               readTeachersData(schoolList,token, callback);
            }else{
              callback("No school found");
            }
        },function(infoObj,token, callback){
            readTeachingRole(infoObj,token,callback)
        },
        function(infoObj,callback){
            writeObjectToChartJsFormat(infoObj,callback);
        }
    ],function(err,data){
        if(data){
            data = JSON.stringify(data);
            fs.writeFileSync('./data/school-stackbar.json', data);
            console.log(data);
        }
    })
    

     
}


const writeTeacherCountinCourse =()=>{
     
    //Get school details
    
    async.waterfall([
        function (callback) {
            getTokenDetails(callback)
        },
        function(token,callback1){
            readTeachersCompleteData(token, callback1);
        },
        function(teachersList,token,callback2){
            if(teachersList && teachersList.length > 0){
             readCourseDetailsFromTeachers(teachersList,token, callback2)
            }else{
                callback2("No Teachers found")
            }
        },
        function(teachers,callback2){
            writeCoursesCountToJson(teachers,callback2);
        }
    ],function(err,data){
       if(data){
            data = JSON.stringify(data);
            fs.writeFileSync('./data/course-bar.json', data);
            console.log(data);
       }

    })
    

     
}


const getDefaultHeaders = (token) => {
    let headers = {
        'content-type': 'application/json',
        'accept': 'application/json',
        'authorization': token
    }
    return headers;
}



startServer = () => {
    server.listen(port, function () {
        console.log("Listening on post:",port)
    })
};


startServer()

 cron.schedule("*/50 * * * * *", function() {
     console.log("running a task every minute");
     writeSchoolSubjectData();
     setTimeout(function () {
        writeTeacherCountinCourse();

      }, 20000)
 });
