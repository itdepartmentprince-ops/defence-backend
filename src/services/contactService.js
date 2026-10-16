const { mongoose } = require("mongoose")
const Contact = require("../models/Contacts")
const ApiError = require("../utils/ApiError")



const createContact = async (contactData) =>{
    const existingContact = await Contact.findOne({
        name:contactData.name, number:contactData.number, course:contactData.course
    })

    if(existingContact){
        throw new ApiError(409,"This Enquiry has already been submitted")
    }

    const contact = await Contact.create(contactData)
    return contact
}

const getContact = async (page=1,limit=10,search="",course="",status="") =>{
    const skip = (page-1)*limit

    let filter = {}

    if(search){
        filter ={
            $or: [{name:{$regex:search, $options:"i"}},{number:{$regex:search, $options:"i"}},{course:{$regex:search, $options:"i"}}]
        }
    }

    if(status){
        filter.status = {$regex:status, $options:"i"}
    }

    if(course){
        filter.course = {$regex:course, $options:"i"}
    }


    const contacts = await Contact.find(filter).sort({createdAt:-1}).skip(skip).limit(limit)
    const total = await Contact.countDocuments(filter)

  
    return {
        contacts,
        page,
        skip,
        limit,
        total,
        totalPages:
        Math.ceil(total/limit)
    }

}



const getContactById = async (id) =>{

    if(!mongoose.Types.ObjectId.isValid(id)){
        throw new ApiError(400,"Invalid Enquiry ID")
    }


    const contact = await Contact.findById(id)
    if(!contact){
        throw new ApiError(404,"Enquiry not found")
    }
    return contact
}
const updateEnquiryStatus = async (id, status) => {

    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(
            400,
            "Invalid Update ID"
        );
    }

    const allowedStatus = [
        "new",
        "open",
        "closed",
    ];

    if (!allowedStatus.includes(status)) {
        throw new ApiError(
            400,
            "Invalid Status. Allowed: new, Open, Closed"
        );
    }

    const contact =
        await Contact.findByIdAndUpdate(
            id,
            { status },
            {
                 
        returnDocument: "after",
        runValidators: true,
    
            }
        );

    if (!contact) {
        throw new ApiError(
            404,
            "Enquiry not Found"
        );
    }

    return contact;
};

const deleteEnquiry = async (id) => {

    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(
            400,
            "Invalid Deleted ID"
        );
    }

    const contact =
        await Contact.findByIdAndDelete(id);

    if (!contact) {
        throw new ApiError(
            404,
            "Enquiry not Found"
        );
    }

    return contact;
};

module.exports = {createContact,getContact,getContactById,updateEnquiryStatus,deleteEnquiry}